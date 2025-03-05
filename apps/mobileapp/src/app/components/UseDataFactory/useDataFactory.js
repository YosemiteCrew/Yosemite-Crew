import React, {useState, useEffect} from 'react';
import {ActivityIndicator, Dimensions, View} from 'react-native';
import {scaledValue} from '../../utils/design.utils';
import API from '../../services/API';
// import Coupons from '../components/Shimmers/Coupons';

const useDataFactory = (
  type,
  paginate = false,
  bodyData = {},
  method = 'GET',
  route,
  url = '',
) => {
  const EmptyPlaceholder = () => (
    <Placeholder subTitle="Oops! No data found in list." />
  );
  const LoginRequiredPlaceholder = () => (
    <Placeholder subTitle="Oops! No data found in list." />
  );
  const internetPlaceholder = () => (
    <Placeholder subTitle="Oops! No Internet connection found." />
  );

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(true);
  const [loadNext, setLoadNext] = useState(true);
  const [body, setBody] = useState(bodyData);
  const [pagination, setPagination] = useState({
    total: 10,
    current_page: 0,
  });

  const [loginRequired, setLoginRequired] = useState(false);
  const [internetFailed, setInternetFailed] = useState(false);

  const routes = {
    getDoctorsLists: 'getDoctorsLists',
  };

  const Loader = () => (
    <View
      style={{
        width: Dimensions.get('window').width - scaledValue(40),
        paddingVertical: 10,
        alignItems: 'center',
      }}>
      {loadNext && !internetFailed && pagination.current_page != 0 && (
        <ActivityIndicator size={'small'} />
      )}
    </View>
  );

  const fetchData = () => {
    if (paginate) {
      if (!loadNext) {
        console.log('here 2');
        return;
      }
      API({
        route: routes[type],
        body: {...body, ...{offset: pagination.current_page}},
        method: method,
      }).then(response => {
        if (response.status === 26) {
          setInternetFailed(true);
          setLoading(false);
          return;
        } else {
          setInternetFailed(false);
        }

        if (response.status === 401) {
          setLoginRequired(true);
          setLoading(false);
          return;
        } else {
          setLoginRequired(false);
        }

        setLoading(false);
        setData([...data, ...response?.data]);
        setPagination({
          total: response?.total,
          current_page: pagination.current_page + 10,
        });
        if (Array.isArray(response?.data) && response?.data?.length < 10) {
          setLoadNext(false);
        }
      });
    } else {
      API({
        route: routes[type],
        body: body,
        method: method,
      }).then(response => {
        if (response.status === 26) {
          setInternetFailed(true);
          setLoading(false);
          return;
        } else {
          setInternetFailed(false);
        }

        if (response.status === 401) {
          setLoginRequired(true);
          setLoading(false);
          return;
        } else {
          setLoginRequired(false);
        }

        setData(response.data);
        setLoading(false);
      });
    }
  };

  const loadMore = () => {
    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, [refresh]);

  const refreshData = (filters = {}) => {
    setBody(filters);
    setLoadNext(true);
    setPagination({
      total: 10,
      current_page: 0,
    });
    setData([]);
    setLoading(true);
    setRefresh(!refresh);
  };

  return {
    loading: loading,
    // Shimmer: Coupons,
    Placeholder: internetFailed
      ? internetPlaceholder
      : loginRequired
      ? LoginRequiredPlaceholder
      : EmptyPlaceholder,
    data: data,
    setData: setData,
    loadMore: loadMore,
    pagination: pagination,
    refreshData: refreshData,
    internetFailed: internetFailed,
    Loader: Loader,
  };
};

export default useDataFactory;

const LoadingShimmer = () => {
  return (
    <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
      <ActivityIndicator size={'small'} />
    </View>
  );
};

const Placeholder = () => {
  return (
    <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
      <ActivityIndicator size={'small'} />
    </View>
  );
};
