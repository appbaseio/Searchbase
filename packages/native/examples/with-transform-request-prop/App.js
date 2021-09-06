import React, { useState, useRef } from 'react';
import {
  SearchBase,
  SearchComponent,
  SearchBox
} from '@appbaseio/react-native-searchbox';
import { AntDesign } from '@expo/vector-icons';
import {
  StyleSheet,
  Text,
  View,
  Platform,
  StatusBar,
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView
} from 'react-native';

const renderResultItem = ({ item }) => {
  return (
    <View style={styles.itemStyle}>
      <Image
        style={styles.image}
        source={{
          uri: item.image
        }}
        resizeMode="contain"
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.textStyle}>{item.original_title}</Text>
        <Text style={styles.textStyle}>by {item.authors}</Text>
        <View style={styles.star}>
          {Array(item.average_rating_rounded)
            .fill('x')
            .map((i, index) => (
              <AntDesign
                key={item._id + `_${index}`}
                name="star"
                size={24}
                color="gold"
              />
            ))}
          <Text style={styles.rating}>({item.average_rating} avg)</Text>
        </View>
        <Text>Pub {item.original_publication_year}</Text>
      </View>
    </View>
  );
};

const renderItemSeparator = () => {
  return (
    // Flat List Item Separator
    <View style={styles.itemSeparator} />
  );
};

function AppContent() {
  const [dataSource, setDataSource] = useState([]);
  const [resetPagination, setResetPagination] = useState(false);
  const [queryVal, setQueryVal] = useState('');

  const stateRef = useRef();
  stateRef.current = dataSource;
  const stateRefQuery = useRef();
  stateRefQuery.current = resetPagination;
  const setResults = results => {
    if (stateRefQuery.current) {
      // Reset paginated data source
      setDataSource(results.data);
      setResetPagination(false);
    } else {
      setDataSource([...stateRef.current, ...results.data]);
    }
  };
  return (
    <SafeAreaView style={styles.container}>
      <SearchBox
        id="search-component"
        dataField={[
          {
            field: 'original_title',
            weight: 1
          },
          {
            field: 'original_title.search',
            weight: 3
          }
        ]}
        onValueSelected={value => {
          setResetPagination(true);
        }}
        transformRequest={request => {
          const suggestedWordsList = [];
          let reqBody = JSON.parse(request.body);
          let getSearchComponentQueryIndex = 0;
          reqBody.query.forEach((item, index) => {
            if (item.id === 'search-component') {
              getSearchComponentQueryIndex = index;
            }
          });
          let queryWord = reqBody.query[getSearchComponentQueryIndex].value;
          let url =
            'https://api.datamuse.com/words?sp=' +
            reqBody.query[getSearchComponentQueryIndex].value +
            '&max=2';
          return (
            fetch(url)
              .then(res => res.json())
              .then(data => {
                if (data.length > 0) {
                  suggestedWordsList.push(data[0].word);
                  queryWord = suggestedWordsList[0];
                }
                if (suggestedWordsList.length) {
                  reqBody.query[getSearchComponentQueryIndex].value =
                    suggestedWordsList[0];
                }
                let newRequest = {
                  ...request,
                  body: JSON.stringify(reqBody)
                };
                return Promise.resolve(newRequest);
              })
              .catch(err => console.error(err))
              // eslint-disable-next-line
              .finally(() => {
                setQueryVal(
                  !queryWord || queryWord === 'undefined' ? '' : queryWord
                );
                if (!suggestedWordsList.length) {
                  return Promise.resolve(request);
                }
              })
          );
        }}
      />
      <Text> {queryVal && <Text> Showing results for {queryVal}</Text>} </Text>
      <SearchComponent
        id="result-component"
        dataField="original_title"
        size={10}
        react={{
          and: ['search-component']
        }}
        onResults={setResults}
      >
        {({ results, loading, size, from, setValue, setFrom }) => {
          return (
            <View>
              {loading && !results.data.length ? (
                <ActivityIndicator
                  style={styles.loader}
                  size="large"
                  color="#000"
                />
              ) : (
                <View>
                  {!results.data.length ? (
                    <Text style={styles.resultStats}>No results found</Text>
                  ) : (
                    <View style={styles.resultContainer}>
                      <Text style={styles.resultStats}>
                        {results.numberOfResults} results found in{' '}
                        {results.time}ms
                      </Text>
                      <FlatList
                        data={dataSource}
                        keyboardShouldPersistTaps={'handled'}
                        keyExtractor={item => item._id}
                        ItemSeparatorComponent={renderItemSeparator}
                        renderItem={renderResultItem}
                        onEndReached={() => {
                          const offset = (from || 0) + size;
                          if (results.numberOfResults > offset) {
                            setFrom((from || 0) + size);
                          }
                        }}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={
                          loading ? (
                            <ActivityIndicator size="large" color="#000" />
                          ) : null
                        }
                      />
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        }}
      </SearchComponent>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SearchBase
      index="good-books-ds"
      credentials="a03a1cb71321:75b6603d-9456-4a5a-af6b-a487b309eb61"
      url="https://appbase-demo-ansible-abxiydt-arc.searchbase.io"
      appbaseConfig={{
        recordAnalytics: true,
        enableQueryRules: true,
        userId: 'jon@appbase.io',
        customEvents: {
          platform: 'ios',
          device: 'iphoneX'
        }
      }}
    >
      <AppContent />
    </SearchBase>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
  },
  loader: {
    marginTop: 50
  },
  itemSeparator: {
    height: 0.5,
    width: '100%',
    backgroundColor: '#C8C8C8'
  },
  image: {
    width: 100,
    marginRight: 10
  },
  itemStyle: {
    flex: 1,
    flexDirection: 'row',
    padding: 10,
    height: 170
  },
  star: {
    flexDirection: 'row',
    paddingBottom: 5
  },
  textStyle: {
    flexWrap: 'wrap',
    paddingBottom: 5
  },
  resultStats: {
    padding: 10
  },
  rating: {
    marginLeft: 10
  }
});