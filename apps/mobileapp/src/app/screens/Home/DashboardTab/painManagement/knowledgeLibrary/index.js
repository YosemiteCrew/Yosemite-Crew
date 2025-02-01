import React, {useEffect, useState} from 'react';
import {
  FlatList,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import GText from '../../../../../components/GText/GText';
import {scaledValue} from '../../../../../utils/design.utils';
import {styles} from './styles'; // Import your styles
import HeaderButton from '../../../../../components/HeaderButton';

const KnowledgeLibrary = ({navigation}) => {
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
          onPress={() => {
            navigation?.goBack();
          }}
        />
      ),
    });
  };

  const topicsList = [
    'All',
    'Arthritis',
    'Back Pain',
    'Pain Meds',
    'NSAIDs',
    'Joint Health',
    'Hip Dysplasia',
    'Limping',
    'Natural Pain Relief',
    'Symptoms',
  ];

  const articleList = [
    {
      id: 1,
      tag1: 'Cats',
      tag2: 'Arthritis',
      tag3: 'Joint Health',
      title:
        'Osteoarthritis in Cats: Symptoms, Causes, and How To Help Your Cat',
      likeCount: 528,
      img: Images.catArticle,
    },
    {
      id: 2,
      tag1: 'Dog',
      tag2: 'Assessment',
      tag3: '',
      title: 'How To Tell if a Dog Is in Pain and What You Can Do To Help',
      likeCount: '1.3K',
      img: Images.dogArticle,
    },
    {
      id: 3,
      tag1: 'NSAID',
      tag2: 'Horse',
      tag3: 'Medicine',
      title: '3 Types of NSAIDs for Horses',
      likeCount: 41,
      img: Images.horseArticle,
    },
  ];

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollView}>
        <SearchBar />
        <HeaderSection />
        <TopicsList
          topics={topicsList}
          selectedTopic={selectedTopic}
          setSelectedTopic={setSelectedTopic}
        />
        <View style={styles.titleView}>
          <GText
            GrMedium
            text={`${t('popular_string')}`}
            style={styles.popularText}
          />
          <GText
            GrMedium
            text={` ${t('articles_string')}`}
            style={styles.articleText}
          />
        </View>
        <ArticlesSection articles={articleList} navigation={navigation} />
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
          text={t('search_for_your_string')}
          style={styles.searchText}
        />
        <GText
          SatoshiBold
          text={` ${t('pet_concern_string')}`}
          style={styles.searchText}
        />
      </View>
      <Image source={Images.Search} style={styles.searchIcon} />
    </TouchableOpacity>
  );
};

const HeaderSection = () => {
  const {t} = useTranslation();
  return (
    <View style={styles.headerContainer}>
      <GText GrMedium text={t('explore_string')} style={styles.ongoingText} />
      <GText
        GrMedium
        text={` ${t('popular_topics_string')}`}
        style={styles.plansText}
      />
    </View>
  );
};

const TopicsList = ({topics, selectedTopic, setSelectedTopic}) => (
  <View style={styles.topicsContainer}>
    <View style={styles.topicsList}>
      {topics.map((topic, index) => (
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

const ArticlesSection = ({articles, navigation}) => {
  const {t} = useTranslation();
  return (
    <View style={styles.flatlistView}>
      <FlatList
        data={articles}
        contentContainerStyle={{gap: scaledValue(28)}}
        renderItem={({item}) => (
          <TouchableOpacity
            onPress={() => {
              navigation?.navigate('StackScreens', {
                screen: 'ArticleDetail',
              });
            }}
            activeOpacity={0.5}
            style={{flexDirection: 'row'}}>
            <Image source={item.img} style={styles.petImg} />
            <View style={{marginLeft: scaledValue(8)}}>
              <View style={styles.tagView}>
                <GText SatoshiBold text={item.tag1} style={styles.tagText} />
                <View style={styles.pointer} />
                <GText SatoshiBold text={item.tag2} style={styles.tagText} />
                {item.tag3 && <View style={styles.pointer} />}
                <GText SatoshiBold text={item.tag3} style={styles.tagText} />
              </View>
              <GText SatoshiBold text={item.title} style={styles.titleText} />
              <View style={styles.likeContainer}>
                <Image
                  source={Images.Heart}
                  tintColor={colors.appRed}
                  style={styles.heartImg}
                />
                <GText
                  SatoshiBold
                  text={` ${item.likeCount} ${t('found_it_helpful_string')}`}
                  style={styles.likeText}
                />
              </View>
            </View>
          </TouchableOpacity>
        )}
        keyExtractor={item => item.id.toString()}
      />
    </View>
  );
};

export default KnowledgeLibrary;
