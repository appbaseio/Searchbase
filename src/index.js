// @flow

import fetch from 'cross-fetch';
import Results from './Results';
import Observable from './observable';
import { getControlValue } from './utils';

// mic constants
const MIC_STATUS = {
  inactive: 'INACTIVE',
  stopped: 'STOPPED',
  active: 'ACTIVE',
  denied: 'DENIED'
};

type MicStatusField = 'INACTIVE' | 'STOPPED' | 'ACTIVE' | 'DENIED';

// TODO: add validation in setters
type UpdateOn = 'change' | 'blur' | 'enter';
type QueryFormat = 'or' | 'and';

type DataField = {
  field: string,
  weight: number
};

type SortOption = {
  label: string,
  dataField: string,
  sortBy: string
};

type Options = {
  triggerQuery?: boolean,
  stateChanges?: boolean
};

type Option = {
  stateChanges?: boolean
};

const defaultOptions: Options = {
  triggerQuery: true,
  stateChanges: true
};

const defaultOption = {
  stateChanges: true
};

class Searchbase {
  static defaultQuery: (
    value: string,
    options: {
      dataField: string | Array<string | DataField>,
      searchOperators?: boolean,
      queryFormat?: QueryFormat,
      fuzziness?: string | number,
      nestedField?: string
    }
  ) => Object;

  static shouldQuery: (
    value: string,
    dataFields: Array<string | DataField>,
    options?: {
      searchOperators?: boolean,
      queryFormat?: QueryFormat,
      fuzziness?: string | number
    }
  ) => Object;

  static generateQueryOptions: (options: {
    size?: number,
    from?: number,
    includeFields?: Array<string>,
    excludeFields?: Array<string>,
    sortOptions?: Array<SortOption>,
    sortBy?: string,
    sortByField?: string
  }) => Object;

  // es index name
  index: string;

  // es url
  url: string;

  // auth credentials if any
  credentials: string;

  // to enable the recording of analytics
  analytics: boolean;

  // input value i.e query term
  value: string;

  // To enable the voice search utilities
  voiceSearch: boolean;

  // custom headers object
  headers: Object;

  // Search query
  query: Object;

  // suggestions query
  suggestionsQuery: Object;

  // To define when to trigger the query
  updateOn: UpdateOn;

  // suggestions
  suggestions: Results;

  // suggestions query error
  suggestionsError: any;

  // results
  results: Results;

  // results query error
  error: any;

  // state changes subject
  stateChanges: Observable;

  // following are the es query options

  nestedField: string;

  queryFormat: QueryFormat;

  searchOperators: boolean;

  size: number;

  from: number;

  fuzziness: string | number;

  sortBy: string;

  sortByField: string;

  dataField: string | Array<string | DataField>;

  includeFields: Array<string>;

  excludeFields: Array<string>;

  sortOptions: Array<SortOption>;

  /* ------------- change events -------------------------------- */

  // called when value changes
  onValueChange: (next: string, prev: string) => void;

  // called when results change
  onResults: (next: string, prev: string) => void;

  // called when suggestions change
  onSuggestions: (next: string, prev: string) => void;

  // called when there is an error while fetching results
  onError: (error: any) => void;

  // called when there is an error while fetching suggestions
  onSuggestionsError: (error: any) => void;

  // mic change event
  onMicStatusChange: (next: string, prev: string) => void;

  /* ---- callbacks to create the side effects while querying ----- */

  transformRequest: (requestOptions: Object) => Promise<Object>;

  transformResponse: (response: any) => Promise<any>;

  beforeValueChange: (value: string) => Promise<any>;

  /* ------ Private properties only for the internal use ----------- */

  // counterpart of the query
  _query: Object;

  // counterpart of the suggestions query
  _suggestionsQuery: Object;

  _queryOptions: Object;

  // search session id, required for analytics
  _searchId: string;

  // mic fields
  _micStatus: MicStatusField;

  _micInstance: Object;

  constructor({
    index,
    url,
    credentials,
    analytics,
    headers,
    value,
    query,
    suggestionsQuery,
    updateOn,
    suggestions,
    results,
    voiceSearch,
    fuzziness,
    searchOperators,
    queryFormat,
    size,
    from,
    dataField,
    includeFields,
    excludeFields,
    transformRequest,
    transformResponse,
    beforeValueChange,
    sortBy,
    nestedField,
    sortOptions
  }: Searchbase) {
    if (!index) {
      throw new Error('Please provide a valid index.');
    }
    if (!url) {
      throw new Error('Please provide a valid url.');
    }
    if (!dataField) {
      throw new Error('Please provide a valid data field.');
    }
    this.index = index;
    this.url = url;
    this.analytics = analytics || false;
    this.dataField = dataField;
    this.credentials = credentials || '';
    this.nestedField = nestedField || '';
    this.updateOn = updateOn || 'change';
    this.queryFormat = queryFormat || 'or';
    this.voiceSearch = voiceSearch || false;
    this.fuzziness = fuzziness || 0;
    this.searchOperators = searchOperators || false;
    this.size = Number(size) || 10;
    this.from = Number(from) || 0;
    this.sortBy = sortBy || '';
    this.includeFields = includeFields || ['*'];
    this.excludeFields = excludeFields || [];
    this.sortOptions = sortOptions || null;

    this.transformRequest = transformRequest || null;
    this.transformResponse = transformResponse || null;
    this.beforeValueChange = beforeValueChange || null;

    // Initialize the state changes observable
    this.stateChanges = new Observable();

    // Initialize the results
    this.suggestions = new Results(suggestions);
    this.results = new Results(results);

    // Initialize headers
    this.headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };
    if (this.credentials) {
      this.headers = {
        ...this.headers,
        Authorization: `Basic ${btoa(this.credentials)}`
      };
    }
    if (headers) {
      this.setHeaders(headers, {
        triggerQuery: false,
        stateChanges: false
      });
    }

    if (value) {
      this.setValue(value, {
        triggerQuery: !query,
        stateChanges: true
      });
    }

    if (query) {
      this.setQuery(query, {
        triggerQuery: true,
        stateChanges: false
      });
    } else {
      this._updateQuery();
    }

    if (suggestionsQuery) {
      this.setSuggestionsQuery(query, {
        triggerQuery: true,
        stateChanges: false
      });
    }
  }

  // getters
  // mic
  get micStatus() {
    return this._micStatus;
  }

  get micInstance() {
    return this._micInstance;
  }

  get micActive() {
    return this._micStatus === MIC_STATUS.active;
  }

  get micStopped() {
    return this._micStatus === MIC_STATUS.stopped;
  }

  get micInactive() {
    return this._micStatus === MIC_STATUS.inactive;
  }

  get micDenied() {
    return this._micStatus === MIC_STATUS.denied;
  }

  get query() {
    return this._query;
  }

  set query(queryTobeSet: Object = {}) {
    const { query, ...queryOptions } = queryTobeSet || {};
    // Apply the custom query DSL
    this._updateQuery(query, queryOptions);
    // Update the Searchbase properties from the user supplied query options
    if (queryOptions) {
      this._syncQueryOptions();
    }
  }

  get suggestionsQuery() {
    return this._suggestionsQuery;
  }

  set suggestionsQuery(queryTobeSet: Object = {}) {
    const { query, ...queryOptions } = queryTobeSet || {};
    // Apply the custom suggestions query DSL
    this._updateSuggestionsQuery(query, queryOptions);
  }

  // Method to subscribe the state changes
  subscribeToStateChanges(
    fn: Function,
    propertiesToSubscribe?: string | Array<string>
  ) {
    this.stateChanges.subscribe(fn, propertiesToSubscribe);
  }

  // Method to unsubscribe the state changes
  unsubscribeToStateChanges(fn?: Function) {
    this.stateChanges.unsubscribe(fn);
  }

  // Method to set the custom headers
  setHeaders(headers: Object, options?: Options = defaultOptions): void {
    const prev = this.headers;
    this.headers = {
      ...this.headers,
      ...headers
    };
    this._applyOptions(options, 'headers', prev, this.headers);
  }

  // Method to set the custom query DSL
  setQuery(query: Object, options?: Options = defaultOptions): void {
    const prev = this.query;
    this.query = query;
    this._applyOptions(options, 'query', prev, this.query);
  }

  // Method to set the custom suggestions query DSL
  setSuggestionsQuery(
    suggestionsQuery: Object,
    options?: Options = defaultOptions
  ): void {
    const prev = this.suggestionsQuery;
    this.suggestionsQuery = suggestionsQuery;
    this._applyOptions(
      options,
      'suggestionsQuery',
      prev,
      this.suggestionsQuery
    );
  }

  // Method to set the size option
  setSize(size: number, options?: Options = defaultOptions): void {
    const prev = this.size;
    this.size = size;
    this._applyOptions(options, 'size', prev, this.size);
  }

  // Method to set the from option
  setFrom(from: number, options?: Options = defaultOptions): void {
    const prev = this.from;
    this.from = from;
    this._applyOptions(options, 'from', prev, this.from);
  }

  // Method to set the fuzziness option
  setFuzziness(
    fuzziness: number | string,
    options?: Options = defaultOptions
  ): void {
    const prev = this.fuzziness;
    this.fuzziness = fuzziness;
    this._applyOptions(options, 'fuzziness', prev, this.fuzziness);
  }

  // Method to set the includeFields option
  setIncludeFields(
    includeFields: Array<string>,
    options?: Options = defaultOptions
  ): void {
    const prev = this.includeFields;
    this.includeFields = includeFields;
    this._applyOptions(options, 'includeFields', prev, includeFields);
  }

  // Method to set the excludeFields option
  setExcludeFields(
    excludeFields: Array<string>,
    options?: Options = defaultOptions
  ): void {
    const prev = this.excludeFields;
    this.excludeFields = excludeFields;
    this._applyOptions(options, 'excludeFields', prev, excludeFields);
  }

  // Method to set the sortBy option
  setSortBy(sortBy: string, options?: Options = defaultOptions): void {
    const prev = this.sortBy;
    this.sortBy = sortBy;
    this._applyOptions(options, 'sortBy', prev, sortBy);
  }

  // Method to set the sortByField option
  setSortByField(
    sortByField: string,
    options?: Options = defaultOptions
  ): void {
    const prev = this.sortByField;
    this.sortByField = sortByField;
    this._applyOptions(options, 'sortByField', prev, sortByField);
  }

  // Method to set the nestedField option
  setNestedField(
    nestedField: string,
    options?: Options = defaultOptions
  ): void {
    const prev = this.nestedField;
    this.nestedField = nestedField;
    this._applyOptions(options, 'nestedField', prev, nestedField);
  }

  // Method to set the dataField option
  setDataField(
    dataField: string | Array<string | DataField>,
    options?: Options = defaultOptions
  ): void {
    const prev = this.dataField;
    this.dataField = dataField;
    this._applyOptions(options, 'dataField', prev, dataField);
  }

  // Method to set the custom results
  setResults(results: Array<Object>, options?: Option = defaultOption): void {
    if (results) {
      const prev = this.results;
      this.results = new Results(results);
      this._applyOptions(
        {
          triggerQuery: false,
          stateChanges: options.stateChanges
        },
        'results',
        prev,
        this.results
      );
    }
  }

  // Method to set the custom suggestions
  setSuggestions(
    suggestions: Array<Object>,
    options?: Option = defaultOption
  ): void {
    if (suggestions) {
      const prev = this.suggestions;
      this.suggestions = new Results(suggestions);
      this._applyOptions(
        {
          triggerQuery: false,
          stateChanges: options.stateChanges
        },
        'suggestions',
        prev,
        this.suggestions
      );
    }
  }

  // Method to set the value
  setValue(value: string, options?: Options = defaultOptions): void {
    const performUpdate = () => {
      const prev = this.value;
      this.value = value;
      this._applyOptions(options, 'value', prev, this.value);
    };
    if (this.beforeValueChange) {
      this.beforeValueChange(value)
        .then(performUpdate)
        .catch(e => {
          console.warn('beforeValueChange rejected the promise with ', e);
        });
    } else {
      performUpdate();
    }
  }

  // Input Events
  onChange = (e: any) => {
    const value = getControlValue(e);
    this.setValue(value);
  };

  // mic event
  onMicClick = (micOptions: Object = {}, options: Options = defaultOptions) => {
    const prevStatus = this._micStatus;
    if (window.SpeechRecognition && prevStatus !== MIC_STATUS.denied) {
      if (prevStatus === MIC_STATUS.active) {
        this._setMicStatus(MIC_STATUS.inactive, options);
      }
      const { SpeechRecognition } = window;
      if (this._micInstance) {
        this._stopMic();
        return;
      }
      this._micInstance = new SpeechRecognition();
      this._micInstance.continuous = true;
      this._micInstance.interimResults = true;
      Object.assign(this._micInstance, micOptions);
      this._micInstance.start();
      this._micInstance.onstart = () => {
        this._setMicStatus(MIC_STATUS.active, options);
      };
      this._micInstance.onresult = ({ results }) => {
        if (results && results[0] && results[0].isFinal) {
          this._stopMic();
        }
        this._handleVoiceResults({ results });
      };
      this._micInstance.onerror = e => {
        if (e.error === 'no-speech' || e.error === 'audio-capture') {
          this._setMicStatus(MIC_STATUS.inactive, options);
        } else if (e.error === 'not-allowed') {
          this._setMicStatus(MIC_STATUS.denied, options);
        }
        console.error(e);
      };
    }
  };

  // Method to execute the query
  triggerQuery(options?: Option = defaultOption): void {
    this._fetchRequest(this.query)
      .then(results => {
        const prev = this.results;
        this.results.setRaw(results);
        this._applyOptions(
          {
            triggerQuery: false,
            stateChanges: options.stateChanges
          },
          'results',
          prev,
          this.results
        );
      })
      .catch(err => {
        this._setError(err, {
          triggerQuery: false,
          stateChanges: options.stateChanges
        });
        console.error(err);
      });
  }

  // Method to execute the suggestions query
  triggerSuggestionsQuery(options?: Option = defaultOption): void {
    this._fetchRequest(this.suggestionsQuery)
      .then(suggestions => {
        const prev = this.suggestions;
        this.suggestions.setRaw(suggestions);
        this._applyOptions(
          {
            triggerQuery: false,
            stateChanges: options.stateChanges
          },
          'suggestions',
          prev,
          this.suggestions
        );
      })
      .catch(err => {
        this._setSuggestionsError(err, {
          triggerQuery: false,
          stateChanges: options.stateChanges
        });
        console.error(err);
      });
  }

  /* -------- Private methods only for the internal use -------- */
  // mic
  _handleVoiceResults = ({ results }: Object) => {
    if (
      results
      && results[0]
      && results[0].isFinal
      && results[0][0]
      && results[0][0].transcript
      && results[0][0].transcript.trim()
    ) {
      this.setValue(results[0][0].transcript.trim());
    }
  };

  _stopMic = () => {
    if (this._micInstance) {
      this._micInstance.stop();
      this._micInstance = null;
      this._setMicStatus(MIC_STATUS.inactive);
    }
  };

  _setMicStatus = (
    status: MicStatusField,
    options: Options = defaultOptions
  ) => {
    const prevStatus = this._micStatus;
    this._micStatus = status;
    this._applyOptions(options, 'micStatus', prevStatus, this._micStatus);
  };

  _handleTransformResponse(res: any): Promise<any> {
    if (
      this.transformResponse
      && typeof this.transformResponse === 'function'
    ) {
      return this.transformResponse(res);
    }
    return new Promise(resolve => resolve(res));
  }

  _handleTransformRequest(requestOptions: any): Promise<any> {
    if (this.transformRequest && typeof this.transformRequest === 'function') {
      return this.transformRequest(requestOptions);
    }
    return new Promise(resolve => resolve(requestOptions));
  }

  _fetchRequest(requestBody: Object): Promise<any> {
    let analyticsHeaders = {};
    // Set analytics headers
    if (this._searchId) {
      analyticsHeaders = {
        'X-Search-Id': this._searchId,
        'X-Search-Query': this.value
      };
    } else if (this.value) {
      analyticsHeaders = {
        'X-Search-Query': this.value
      };
    }

    const requestOptions = {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        ...this.headers,
        ...analyticsHeaders
      }
    };

    return new Promise((resolve, reject) => {
      this._handleTransformRequest(requestOptions)
        .then(finalRequestOptions => {
          // set timestamp in request
          const timestamp = Date.now();

          return fetch(`${this.url}/${this.index}/_search`, finalRequestOptions)
            .then(res => {
              const responseHeaders = res.headers;

              // set search id
              if (res.headers) {
                this._searchId = res.headers.get('X-Search-Id') || null;
              }

              if (res.status >= 500) {
                return reject(res);
              }
              if (res.status >= 400) {
                return reject(res);
              }
              return res.json().then(data => {
                this._handleTransformResponse(data)
                  .then(transformedData => {
                    if (
                      transformedData
                      && Object.prototype.hasOwnProperty.call(
                        transformedData,
                        'error'
                      )
                    ) {
                      reject(transformedData);
                    }
                    const response = {
                      ...transformedData,
                      _timestamp: timestamp,
                      _headers: responseHeaders
                    };
                    return resolve(response);
                  })
                  .catch(e => {
                    console.warn(
                      'transformResponse rejected the promise with ',
                      e
                    );
                    return reject(e);
                  });
              });
            })
            .catch(e => reject(e));
        })
        .catch(e => {
          console.warn('transformRequest rejected the promise with ', e);
          return reject(e);
        });
    });
  }

  _setSuggestionsError(
    suggestionsError: any,
    options?: Options = defaultOptions
  ) {
    const prev = this.suggestionsError;
    this.suggestionsError = suggestionsError;
    this._applyOptions(
      options,
      'suggestionsError',
      prev,
      this.suggestionsError
    );
  }

  _setError(error: any, options?: Options = defaultOptions) {
    const prev = this.error;
    this.error = error;
    this._applyOptions(options, 'error', prev, this.error);
  }

  // Method to set the default query value
  _updateQuery(query?: Object, queryOptions?: Object): void {
    // Set default query here
    const finalQueryOptions = Searchbase.generateQueryOptions({
      excludeFields: this.excludeFields,
      includeFields: this.includeFields,
      size: this.size,
      from: this.from,
      sortBy: this.sortBy,
      sortByField: this.sortByField,
      sortOptions: this.sortOptions
    });
    /**
     * First priority goes to the custom query set by user otherwise execute the default query
     * If none of the two exists execute the match_all
     */
    const finalQuery = query
      || Searchbase.defaultQuery(this.value, {
        dataField: this.dataField,
        searchOperators: this.searchOperators,
        queryFormat: this.queryFormat,
        fuzziness: this.fuzziness,
        nestedField: this.nestedField
      }) || {
        match_all: {}
      };
    this._query = {
      query: finalQuery,
      ...finalQueryOptions,
      // Overrides the default options by the user defined options
      ...queryOptions
    };
  }

  _updateSuggestionsQuery(query?: Object, queryOptions?: Object): void {
    // Set default suggestions query here
    const finalQueryOptions = Searchbase.generateQueryOptions({
      size: 10
    });
    /**
     * First priority goes to the custom query set by user otherwise execute the default query
     * If none of the two exists execute the match_all
     */
    const finalQuery = query
      || Searchbase.defaultQuery(this.value, {
        dataField: this.dataField,
        searchOperators: this.searchOperators,
        queryFormat: this.queryFormat,
        fuzziness: this.fuzziness,
        nestedField: this.nestedField
      }) || {
        match_all: {}
      };
    this._suggestionsQuery = {
      query: finalQuery,
      ...finalQueryOptions,
      // Overrides the default options by the user defined options
      ...queryOptions
    };
  }

  // Method to sync the user defined query options to the Searchbase properties
  _syncQueryOptions(
    queryOptions?: Object = {
      triggerQuery: false, // Just sync the values, no need to trigger the query
      stateChanges: true
    }
  ): void {
    if (queryOptions.size !== undefined) {
      this.setSize(queryOptions.size, queryOptions);
    }
    // TODO: sync all options which we support i.e from, include-exclude Fields, sortBy etc
  }

  // Method to apply the changed based on set options
  _applyOptions(
    options: Options,
    key: string,
    prevValue: any,
    nextValue: any
  ): void {
    // Trigger mic events
    if (key === 'micStatus' && this.onMicStatusChange) {
      this.onMicStatusChange(prevValue, nextValue);
    }
    // Trigger events
    if (key === 'value' && this.onValueChange) {
      this.onValueChange(prevValue, nextValue);
    }
    if (key === 'error' && this.onError) {
      this.onError(prevValue);
    }
    if (key === 'suggestionsError' && this.onSuggestionsError) {
      this.onSuggestionsError(prevValue);
    }
    if (key === 'results' && this.onResults) {
      this.onResults(prevValue, nextValue);
    }
    if (key === 'suggestions' && this.onSuggestions) {
      this.onSuggestions(prevValue, nextValue);
    }
    if (options.triggerQuery) {
      this.triggerQuery();
    }
    if (options.stateChanges) {
      console.log('Property Changed', key);
      this.stateChanges.next(
        {
          [key]: {
            prev: prevValue,
            next: nextValue
          }
        },
        key
      );
    }
  }
}

/* ------------------ Static methods ------------------------------ */

// function to generate the default query DSL
Searchbase.defaultQuery = function (value, options) {
  let finalQuery = null;
  let fields;

  if (value) {
    if (Array.isArray(options.dataField)) {
      fields = options.dataField;
    } else {
      fields = [options.dataField];
    }

    if (options.searchOperators) {
      finalQuery = {
        simple_query_string: Searchbase.shouldQuery(value, fields, options)
      };
    } else {
      finalQuery = {
        bool: {
          should: Searchbase.shouldQuery(value, fields, options),
          minimum_should_match: '1'
        }
      };
    }
  }

  if (value === '') {
    finalQuery = null;
  }

  if (finalQuery && options.nestedField) {
    finalQuery = {
      nested: {
        path: options.nestedField,
        query: finalQuery
      }
    };
  }

  return finalQuery;
};

// helper function of default query
Searchbase.shouldQuery = function (
  value,
  dataFields,
  options = {
    searchOperators: false,
    queryFormat: 'or',
    fuzziness: 0
  }
) {
  const fields = dataFields.map((dataField: string | DataField) => {
    if (typeof dataField === 'object') {
      return `${dataField.field}${
        dataField.weight ? `^${dataField.weight}` : ''
      }`;
    }
    return dataField;
  });

  if (options.searchOperators) {
    return {
      query: value,
      fields,
      default_operator: options.queryFormat
    };
  }

  if (options.queryFormat === 'and') {
    return [
      {
        multi_match: {
          query: value,
          fields,
          type: 'cross_fields',
          operator: 'and'
        }
      },
      {
        multi_match: {
          query: value,
          fields,
          type: 'phrase_prefix',
          operator: 'and'
        }
      }
    ];
  }

  return [
    {
      multi_match: {
        query: value,
        fields,
        type: 'best_fields',
        operator: 'or',
        fuzziness: options.fuzziness
      }
    },
    {
      multi_match: {
        query: value,
        fields,
        type: 'phrase_prefix',
        operator: 'or'
      }
    }
  ];
};

// function to generate the query DSL options
Searchbase.generateQueryOptions = function (options) {
  const finalOptions = {};
  if (options.size !== undefined) {
    finalOptions.size = options.size;
  }
  if (options.from !== undefined) {
    finalOptions.from = options.from;
  }
  if (options.includeFields || options.excludeFields) {
    const source = {};
    if (options.includeFields) {
      source.includes = options.includeFields;
    }
    if (options.excludeFields) {
      source.excludes = options.excludeFields;
    }
    finalOptions._source = source;
  }

  if (options.sortOptions) {
    finalOptions.sort = [
      {
        [options.sortOptions[0].dataField]: {
          order: options.sortOptions[0].sortBy
        }
      }
    ];
  } else if (options.sortBy && options.sortByField) {
    finalOptions.sort = [
      {
        [options.sortByField]: {
          order: options.sortBy
        }
      }
    ];
  }
  return finalOptions;
};

module.exports = Searchbase;
