import {
  FlatList,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect, useState} from 'react';
import HeaderButton from '../../../../components/HeaderButton';
import {Images} from '../../../../utils';
import {colors} from '../../../../../assets/colors';
import GText from '../../../../components/GText/GText';
import {useTranslation} from 'react-i18next';
import BlogListingCard from './BlogListingCard';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {styles} from './styles';

const BlogListing = ({navigation}) => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const [selectedTopic, setSelectedTopic] = useState('All');
  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          tintColor={colors.appRed}
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'Notifications',
            });
          }}
        />
      ),
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  };

  const topicsList = [
    'All',
    'Medication',
    'Nutrition',
    'Limping',
    'Fleas and Ticks',
    'Pet Anxiety',
    'Hip Dysplasia',
    'Mental Health',
    'Allergies',
    'Wellness',
    'Socialization',
    'Skin Care',
    'Insurance',
    'Allergies',
    'Socialization',
  ];

  return (
    <View style={styles.mainContainer}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <GText GrMedium text={'Featured'} style={styles.featuredText} />
        <View>
          <FlatList
            data={[1, 2, 3, 4, 5]}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.swipeImageView}
            renderItem={() => {
              return (
                <TouchableOpacity
                  onPress={() => {
                    navigation?.navigate('StackScreens', {
                      screen: 'BlogDetail',
                    });
                  }}>
                  <Image source={Images.horseArticle} style={styles.petImage} />
                </TouchableOpacity>
              );
            }}
          />
        </View>
        <GText
          GrMedium
          text={t('new_puppy_checklist_string')}
          style={styles.newPuppyChecklistText}
        />

        <GText
          GrMedium
          text={t('explore_topics_string')}
          style={styles.exploreTopicText}
        />
        <TopicsList
          topics={topicsList}
          selectedTopic={selectedTopic}
          setSelectedTopic={setSelectedTopic}
        />
        <SearchBar />
        <View>
          <FlatList
            data={[1, 2, 3, 4]}
            contentContainerStyle={styles.contentContainerStyle(insets)}
            renderItem={item => {
              return (
                <BlogListingCard
                  onPress={() => {
                    navigation?.navigate('StackScreens', {
                      screen: 'BlogDetail',
                    });
                  }}
                />
              );
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const SearchBar = () => {
  const {t} = useTranslation();
  return (
    <TouchableOpacity style={styles.searchBar}>
      <View style={styles.searchTextContainer}>
        <GText
          SatoshiRegular
          text={t('search_a_string')}
          style={styles.searchText}
        />
        <GText
          SatoshiBold
          text={` ${t('topic_string')}`}
          style={styles.searchText}
        />
      </View>
      <Image source={Images.Search} style={styles.searchIcon} />
    </TouchableOpacity>
  );
};

const TopicsList = ({topics, selectedTopic, setSelectedTopic}) => (
  <View style={styles.topicsContainer}>
    <View style={styles.topicsList}>
      {topics?.map((topic, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => setSelectedTopic(topic)}
          style={styles.topicButton(selectedTopic, topic)}>
          <GText
            GrMedium
            text={topic}
            style={styles.topicText(selectedTopic, topic)}
          />
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

export default BlogListing;
