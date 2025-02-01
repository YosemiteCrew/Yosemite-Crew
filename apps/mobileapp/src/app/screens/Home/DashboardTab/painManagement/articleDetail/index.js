import {
  Image,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  View,
} from 'react-native';
import React from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {styles} from './styles';
import {Images} from '../../../../../utils';
import GText from '../../../../../components/GText/GText';
import {colors} from '../../../../../../assets/colors';
import GButton from '../../../../../components/GButton';

const ArticleDetail = () => {
  const insets = useSafeAreaInsets();
  const {t} = useTranslation();
  return (
    <ScrollView
      bounces={false}
      showsVerticalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={{
        paddingBottom: insets.bottom,
      }}>
      <StatusBar backgroundColor="transparent" translucent />
      <Image source={Images.catArticle} style={styles.petImg} />
      <View style={styles.headerContainer}>
        <GText
          GrMedium
          text={
            'Osteoarthritis in Cats: Symptoms, Causes, and How To Help Your Cat'
          }
          style={styles.titleText}
        />
        <TouchableOpacity style={styles.shareImgView}>
          <Image
            source={Images.Share}
            tintColor={colors.appRed}
            style={styles.shareImg}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.tagView}>
        <GText SatoshiBold text={'Cats'} style={styles.tagText} />
        <View style={styles.pointer} />
        <GText SatoshiBold text={'Arthritis'} style={styles.tagText} />
        <View style={styles.pointer} />
        <GText SatoshiBold text={'Joint Health'} style={styles.tagText} />
      </View>
      <View style={styles.titleView}>
        <GText
          GrMedium
          text={'What is Arthritis in Cats?'}
          style={styles.titleText}
        />
        <GText
          SatoshiRegular
          text={
            'Arthritis (also called degenerative joint disease or osteoarthritis) is a chronic, painful, progressive condition involving the joints of cats. As in people, this is commonly associated with aging, and likely impacts between 70% and 90% of cats over 12 years old.'
          }
          style={styles.subTitleText}
        />
        <GText
          SatoshiRegular
          text={
            'Arthritis usually takes years to develop, with many changes occurring in the joints. The cartilage that normally lines and cushions the joint breaks down, allowing bones to rub together abnormally. Nearby bone may splinter and form sharp, bony projections into the joint. These leads to swelling, inflammation, and pain in the joints.'
          }
          style={styles.subTitleText}
        />
        <GText
          SatoshiRegular
          text={
            'Most affected joints include the spine, hip, knees, and elbows—although any joint can develop arthritis. It is a progressive disease, meaning it continues to worsen over time. Because these joint changes cause pain, cats can show decreased mobility and lameness when they have arthritis.'
          }
          style={styles.subTitleText}
        />

        <GButton
          title={t('if_you_find_helpful_string')}
          icon={Images.HeartBold}
          iconStyle={styles.buttonIcon}
          textStyle={styles.buttonText}
          style={styles.button(insets)}
        />
      </View>
    </ScrollView>
  );
};

export default ArticleDetail;
