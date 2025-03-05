import React from 'react';
import {Dimensions, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {createShimmerPlaceholder} from 'react-native-shimmer-placeholder';
import {scaledValue} from '../../utils/design.utils';

const Shimmer = createShimmerPlaceholder(LinearGradient);
const DEVICE_WIDTH = Dimensions.get('window').width;

export const Coupons = () => {
  return (
    <View style={{flexDirection: 'row'}}>
      <View>
        <Coupon
          style={{
            height: 270,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.5 - 24,
            marginBottom: 10,
            marginTop: 10,
          }}
        />
        <Coupon
          style={{
            height: 20,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.5 - 24,
          }}
        />
      </View>
      <View>
        <Coupon
          style={{
            height: 270,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.5 - 24,
            marginBottom: 10,
            marginTop: 10,
          }}
        />
        <Coupon
          style={{
            height: 20,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.5 - 24,
          }}
        />
      </View>
    </View>
  );
};

export const SpotlightShimer = () => {
  return (
    <View style={{flexDirection: 'row'}}>
      <View>
        <Coupon
          style={{
            height: 235,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.5 - 24,
            marginBottom: 10,
            marginTop: 10,
          }}
        />
        <Coupon
          style={{
            height: 20,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.5 - 24,
          }}
        />
      </View>
      <View>
        <Coupon
          style={{
            height: 235,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.5 - 24,
            marginBottom: 10,
            marginTop: 10,
          }}
        />
        <Coupon
          style={{
            height: 20,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.5 - 24,
          }}
        />
      </View>
    </View>
  );
};
export const FeedShimmer = () => {
  return (
    <View>
      <Coupon
        style={{
          height: Dimensions.get('screen').height / 1.4,
          marginLeft: scaledValue(16),
          width: DEVICE_WIDTH - 65,
          marginBottom: 10,
          marginTop: 10,
        }}
      />
      {/* <Coupon
        style={{
          height: Dimensions.get('screen').height / 20,
          marginLeft: scaledValue(16),
          width: DEVICE_WIDTH - 60,
        }}
      /> */}
    </View>
  );
};
export const SpotlightStyledShimer = () => {
  return (
    <View style={{flexDirection: 'row'}}>
      <View>
        <Coupon
          style={{
            height: 100,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.25 - 20,
            marginBottom: 10,
            marginTop: 10,
          }}
        />
        <Coupon
          style={{
            height: 15,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.25 - 20,
          }}
        />
      </View>
      <View>
        <Coupon
          style={{
            height: 100,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.25 - 20,
            marginBottom: 10,
            marginTop: 10,
          }}
        />
        <Coupon
          style={{
            height: 15,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.25 - 20,
          }}
        />
      </View>
      <View>
        <Coupon
          style={{
            height: 100,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.25 - 20,
            marginBottom: 10,
            marginTop: 10,
          }}
        />
        <Coupon
          style={{
            height: 15,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.25 - 20,
          }}
        />
      </View>
      <View>
        <Coupon
          style={{
            height: 100,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.25 - 20,
            marginBottom: 10,
            marginTop: 10,
          }}
        />
        <Coupon
          style={{
            height: 15,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.25 - 20,
          }}
        />
      </View>
    </View>
  );
};
export const SpotlightBrandsShimer = () => {
  return (
    <View style={{flexDirection: 'row'}}>
      <View>
        <Coupon
          style={{
            height: 30,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.25 - 20,
            marginBottom: 10,
            marginTop: 10,
          }}
        />
        <Coupon
          style={{
            height: 14,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.25 - 20,
          }}
        />
      </View>
      <View>
        <Coupon
          style={{
            height: 30,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.25 - 20,
            marginBottom: 10,
            marginTop: 10,
          }}
        />
        <Coupon
          style={{
            height: 14,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.25 - 20,
          }}
        />
      </View>
      <View>
        <Coupon
          style={{
            height: 30,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.25 - 20,
            marginBottom: 10,
            marginTop: 10,
          }}
        />
        <Coupon
          style={{
            height: 14,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.25 - 20,
          }}
        />
      </View>
      <View>
        <Coupon
          style={{
            height: 30,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.25 - 20,
            marginBottom: 10,
            marginTop: 10,
          }}
        />
        <Coupon
          style={{
            height: 14,
            marginLeft: scaledValue(16),
            width: DEVICE_WIDTH * 0.25 - 20,
          }}
        />
      </View>
    </View>
  );
};
export const TopStyleShimer = () => {
  return (
    <View style={{flexDirection: 'row'}}>
      <View>
        <Coupon
          style={{
            height: 440,
            marginLeft: scaledValue(16),
            width: scaledValue(270),
          }}
        />
      </View>
      <View>
        <Coupon
          style={{
            height: 440,
            marginLeft: scaledValue(16),
            width: scaledValue(270),
          }}
        />
      </View>
    </View>
  );
};

export const CircularShimmer = () => {
  return (
    <View
      style={{
        borderRadius: 80,
        overflow: 'hidden',
        width: 80,
        height: 80,
      }}>
      <Shimmer autoRun={true} visible={false} style={{flex: 1}} />
    </View>
  );
};
const Coupon = ({style}) => {
  return (
    <View
      style={[
        {
          backgroundColor: 'white',
          width: '100%',
        },
        style,
      ]}>
      <Shimmer
        // shimmerColors={['#F4F5F8', '#E3E5EC', '#F4F5F8']}
        // shimmerColors={['#FFE8D1', '#FFF8F0', '#FFE8D1']}
        // shimmerColors={['#FFF7EE', '#FFFFFF', '#FFF7EE']}
        shimmerColors={['#FFECD9', '#FFF8ED', '#FFECD9']}
        style={{
          height: '100%',
          width: '100%',
          borderRadius: 10,
        }}></Shimmer>
    </View>
  );
};

export const BusinessListShimmer = style => {
  return (
    <View style={{flexDirection: 'row'}}>
      <View>
        <Coupon
          style={{
            height: scaledValue(133.33),
            marginLeft: scaledValue(16),
            width: scaledValue(200),
            marginBottom: scaledValue(12),
          }}
        />
        <Coupon
          style={{
            height: scaledValue(90),
            marginLeft: scaledValue(16),
            width: scaledValue(200),
            marginBottom: scaledValue(12),
          }}
        />
        {/* <Coupon
          style={{
            height: scaledValue(38),
            marginLeft: scaledValue(16),
            width: scaledValue(200),
          }}
        /> */}
      </View>
      <View>
        <Coupon
          style={{
            height: scaledValue(133.33),
            marginLeft: scaledValue(16),
            width: scaledValue(200),
            marginBottom: scaledValue(12),
          }}
        />
        <Coupon
          style={{
            height: scaledValue(90),
            marginLeft: scaledValue(16),
            width: scaledValue(200),
            marginBottom: scaledValue(12),
          }}
        />
        <Coupon
          style={{
            height: scaledValue(38),
            marginLeft: scaledValue(16),
            width: scaledValue(200),
          }}
        />
      </View>
    </View>
  );
};
