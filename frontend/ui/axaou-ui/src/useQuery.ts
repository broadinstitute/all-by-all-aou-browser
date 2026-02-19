import axios from 'axios';
import { useState, useEffect } from 'react';
import PouchDB from 'pouchdb';

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
  const db = new PouchDB(dbName);

  useEffect(() => {
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

      const handleQuery = async (query: Query) => {
        if (query.queryMode === QueryMode.two_step) {
          await handleTwoStepQuery(query);
        } else {
          await handleSingleQuery(query);
        }
      };

      try {
        await Promise.all(
          queries.map(async (query) => {
            await handleQuery(query).catch(handleError(query.name));
          })
        );
      } catch (err) {
        // Handle unexpected errors if necessary
      }
    };

    const handleSingleQuery = async (query: Query) => {
      const separator = query.url.includes('?') ? '&' : '?';
      const url = query.queryMode
        ? `${query.url}${separator}query_mode=${query.queryMode}`
        : `${query.url}`;

      let data;

      if (cacheEnabled) {
        try {
          const cachedEntry = await db.get(url);
          // @ts-ignore
          data = cachedEntry.data;
          console.debug(`Cache hit for data: ${query.name}`);
          updateState(query.name, data);
          return;
        } catch (cacheError) {
          console.debug(`Did not get data from cache: ${query.name}`, cacheError);
        }
      }

      try {
        const response = await axios.get(url);
        // Auto-unwrap LookupResult wrapper if present
        data = response.data?.data !== undefined ? response.data.data : response.data;
        updateState(query.name, data);
        if (cacheEnabled) {
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

      // Attempt to retrieve cached fast data
      if (cacheEnabled) {
        try {
          const cachedData = await db.get(fastUrl);
          // @ts-ignore
          fastData = cachedData.data;
          updatePartialState(query.name, fastData, true);
        } catch (error) {
          console.debug(`Cache miss for fast data: ${query.name}`, error);
          // Cache miss for fast data, will fetch from API
        }
      }

      // If no cached fast data, fetch from API
      if (fastData === null) {
        try {
          const response = await axios.get(fastUrl);
          // Auto-unwrap LookupResult wrapper if present
          fastData = response.data?.data !== undefined ? response.data.data : response.data;
          console.debug(`Fetched fast data from API: ${query.name}`);
          updatePartialState(query.name, fastData, true);
          if (cacheEnabled) {
            try {
              await db.put({ _id: fastUrl, data: fastData });
              console.debug(`Stored fast data in cache: ${query.name}`);
            } catch (cacheError) {
              console.error(`Failed to store fast data in cache: ${query.name}`, cacheError);
              // Handle cache write error
            }
          }
        } catch (err) {
          handleError(query.name)(err);
          return;
        }
      }

      // Check if fastData is an array and empty
      if (Array.isArray(fastData) && fastData.length <= (query.queryModeMinItems || 0)) {
        // Attempt to retrieve cached slow data
        if (cacheEnabled) {
          try {
            // @ts-ignore
            const { data: slowData } = await db.get(slowUrl);
            updateState(query.name, slowData);
            return;
          } catch (error) {
            console.debug(`Cache miss for slow data: ${query.name}`, error);
            // Cache miss for slow data, will fetch from API
          }
        }

        // Fetch slow data from API
        try {
          const response = await axios.get(slowUrl);
          // Auto-unwrap LookupResult wrapper if present
          slowData = response.data?.data !== undefined ? response.data.data : response.data;
          updateState(query.name, slowData);
          if (cacheEnabled) {
            try {
              await db.put({ _id: slowUrl, data: slowData });
            } catch {
              // Handle cache write error
            }
          }
        } catch (err) {
          handleError(query.name)(err);
        }
      } else {
        // Fast data is sufficient, no need to fetch slow data
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

    const updateState = (name: string, data: any) => {
      setStates((prevState: any) => ({
        ...prevState,
        [name]: {
          ...prevState[name],
          isLoading: false,
          partiallyLoaded: false,
          data: data,
        },
      }));
    };

    const updatePartialState = (name: string, data: any, partiallyLoaded: boolean) => {
      setStates((prevState: any) => ({
        ...prevState,
        [name]: {
          ...prevState[name],
          data: data,
          partiallyLoaded,
        },
      }));
    };

    const handleError = (name: string) => (err: any) => {
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

    void fetchData();
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

