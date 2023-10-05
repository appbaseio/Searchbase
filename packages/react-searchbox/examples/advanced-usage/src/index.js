import { createRoot } from 'react-dom/client';
import React from 'react';
import { SearchBase } from '@appbaseio/react-searchbox';

import './styles.css';
import Search from './components/Search';
import Filter from './components/Filter';
import Results from './components/Results';
import SelectedFilters from './components/SelectedFilter';

const App = () => (
  <SearchBase
    index="good-books-ds"
    credentials="a03a1cb71321:75b6603d-9456-4a5a-af6b-a487b309eb61"
    url="https://appbase-demo-ansible-abxiydt-arc.searchbase.io"
  >
    <div>
      <Search />
      <div className="row">
        <div className="col">
          <Filter />
        </div>

        <div className="col">
          {/* a component to render the selected authors from filter facet with id='author-filter' */}
          <SelectedFilters />
          <Results />
        </div>
      </div>
    </div>
  </SearchBase>
);

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
