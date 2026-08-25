import axios from 'axios';
import { useState, useEffect } from 'react';
import { getQueryCacheDatabase } from './queryCache';

interface Warning {
  item: string;
  message?: string;
}

enum QueryMode {
  fast = 'fast',
  slow = 'slow',
  two_step = 'two_step',
}

interface Query {
  url: string;
  name: string;
  data?: any;
  cachedData?: any;
  validator?: any;
  queryMode?: QueryMode;
  queryModeMinItems?: number
}

interface UseQueryArgs {
  dbName: string;
  queries: Query[];
  deps: any[];
  cacheEnabled: boolean;
}

export interface QueryState<T> {
  isLoading: boolean;
  data: T | undefined;
  error: {
    message: string | null;
    status?: number;
    response?: any;
  } | null;
  warnings?: Warning[];
  partiallyLoaded?: boolean;
}

const initialState = {
  isLoading: true,
  data: undefined,
  error: null,
  warnings: [],
  partiallyLoaded: false,
};

export function useQuery<T>({
  dbName,
  queries,
  deps,
  cacheEnabled = true,
}: UseQueryArgs) {
  const [states, setStates] = useState<{
    [K in keyof T]: QueryState<T[K]>;
  }>(
    queries.reduce((acc, query) => {
      acc[query.name as keyof T] = initialState;
      return acc;
    }, {} as { [K in keyof T]: QueryState<T[K]> })
  );

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();
    const db = cacheEnabled ? getQueryCacheDatabase(dbName) : null;

    const updateState = (name: string, data: any) => {
      if (cancelled) return;
      setStates((prevState: any) => ({
        ...prevState,
        [name]: {
          ...prevState[name],
          isLoading: false,
          partiallyLoaded: false,
          data,
        },
      }));
    };

    const updatePartialState = (name: string, data: any, partiallyLoaded: boolean) => {
      if (cancelled) return;
      setStates((prevState: any) => ({
        ...prevState,
        [name]: {
          ...prevState[name],
          data,
          partiallyLoaded,
        },
      }));
    };

    const handleError = (name: string) => (err: any) => {
      if (cancelled || axios.isCancel(err)) return;

      let error: string | null = null;
      let status: number | undefined;
      let response: any = null;

      if (axios.isAxiosError(err)) {
        error = err.message;
        status = err.response?.status;
        response = err.response?.data;
      } else if (err instanceof Error) {
        error = err.message;
      }

      setStates((prevState) => ({
        ...prevState,
        [name]: {
          ...prevState[name as keyof T],
          error: { message: error, status, response },
          isLoading: false,
          partiallyLoaded: false,
        },
      }));
    };

    const handleSingleQuery = async (query: Query) => {
      const separator = query.url.includes('?') ? '&' : '?';
      const url = query.queryMode
        ? `${query.url}${separator}query_mode=${query.queryMode}`
        : query.url;

      let data;

      if (db) {
        try {
          const cachedEntry = await db.get(url);
          if (cancelled) return;
          // @ts-ignore
          data = cachedEntry.data;
          console.debug(`Cache hit for data: ${query.name}`);
          updateState(query.name, data);
          return;
        } catch (cacheError) {
          console.debug(`Did not get data from cache: ${query.name}`, cacheError);
        }
      }

      if (cancelled) return;
      try {
        const response = await axios.get(url, { signal: abortController.signal });
        if (cancelled) return;
        // Auto-unwrap LookupResult wrapper if present
        data = response.data?.data !== undefined ? response.data.data : response.data;
        updateState(query.name, data);
        if (db) {
          try {
            await db.put({ _id: url, data });
          } catch (cacheError) {
            console.debug(`Failed to store data in cache: ${query.name}`, cacheError);
          }
        }
      } catch (err) {
        console.debug(`Error fetching data for query: ${query.name}`, err);
        handleError(query.name)(err);
      }
    };

    const handleTwoStepQuery = async (query: Query) => {
      const separator = query.url.includes('?') ? '&' : '?';
      const fastUrl = `${query.url}${separator}query_mode=fast`;
      const slowUrl = `${query.url}${separator}query_mode=slow`;

      let fastData: any = null;
      let slowData: any = null;

      if (db) {
        try {
          const cachedData = await db.get(fastUrl);
          if (cancelled) return;
          // @ts-ignore
          fastData = cachedData.data;
          updatePartialState(query.name, fastData, true);
        } catch (error) {
          console.debug(`Cache miss for fast data: ${query.name}`, error);
        }
      }

      if (fastData === null) {
        if (cancelled) return;
        try {
          const response = await axios.get(fastUrl, { signal: abortController.signal });
          if (cancelled) return;
          fastData = response.data?.data !== undefined ? response.data.data : response.data;
          console.debug(`Fetched fast data from API: ${query.name}`);
          updatePartialState(query.name, fastData, true);
          if (db) {
            try {
              await db.put({ _id: fastUrl, data: fastData });
              console.debug(`Stored fast data in cache: ${query.name}`);
            } catch (cacheError) {
              console.error(`Failed to store fast data in cache: ${query.name}`, cacheError);
            }
          }
        } catch (err) {
          handleError(query.name)(err);
          return;
        }
      }

      if (cancelled) return;
      if (Array.isArray(fastData) && fastData.length <= (query.queryModeMinItems || 0)) {
        if (db) {
          try {
            const cachedSlowData = await db.get(slowUrl);
            if (cancelled) return;
            // @ts-ignore
            slowData = cachedSlowData.data;
            updateState(query.name, slowData);
            return;
          } catch (error) {
            console.debug(`Cache miss for slow data: ${query.name}`, error);
          }
        }

        if (cancelled) return;
        try {
          const response = await axios.get(slowUrl, { signal: abortController.signal });
          if (cancelled) return;
          slowData = response.data?.data !== undefined ? response.data.data : response.data;
          updateState(query.name, slowData);
          if (db) {
            try {
              await db.put({ _id: slowUrl, data: slowData });
            } catch {
              // A cache write failure does not invalidate the network result.
            }
          }
        } catch (err) {
          handleError(query.name)(err);
        }
      } else if (!cancelled) {
        setStates((prevState: any) => ({
          ...prevState,
          [query.name]: {
            ...prevState[query.name],
            isLoading: false,
            partiallyLoaded: false,
          },
        }));
      }
    };

    const fetchData = async () => {
      setStates((prevStates) =>
        queries.reduce(
          (newStates, query) => ({
            ...newStates,
            [query.name]: {
              ...prevStates[query.name as keyof T],
              isLoading: true,
              partiallyLoaded: query.queryMode === QueryMode.two_step,
            },
          }),
          { ...prevStates }
        )
      );

      await Promise.all(
        queries.map(async (query) => {
          const queryPromise = query.queryMode === QueryMode.two_step
            ? handleTwoStepQuery(query)
            : handleSingleQuery(query);
          await queryPromise.catch(handleError(query.name));
        })
      );
    };

    void fetchData();

    return () => {
      cancelled = true;
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const allLoading = (): boolean => {
    return Object.values(states).every(
      (state) => (state as QueryState<T[keyof T]>).isLoading
    );
  };

  const anyLoading = (): boolean => {
    return Object.values(states).some(
      (state) => (state as QueryState<T[keyof T]>).isLoading
    );
  };

  return { queryStates: states, allLoading, anyLoading };
}
