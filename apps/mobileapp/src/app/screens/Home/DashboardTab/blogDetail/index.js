import {
  Image,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React from 'react';
import {colors} from '../../../../../assets/colors';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../utils';
import GText from '../../../../components/GText/GText';
import {styles} from './styles';
import {scaledValue} from '../../../../utils/design.utils';
import ArticleCard from './ArticleCard';

const BlogDetail = () => {
  const {t} = useTranslation();
  return (
    <ScrollView
      bounces={false}
      showsVerticalScrollIndicator={false}
      style={styles.container}>
      <StatusBar backgroundColor="transparent" translucent />
      <Image source={Images.horseArticle} style={styles.petImg} />
      <View style={styles.headerContainer}>
        <GText
          GrMedium
          text={'New Puppy Checklist: Everything You Need to Get Started '}
          style={styles.titleText}
        />
        <View style={{alignItems: 'center'}}>
          <TouchableOpacity style={styles.shareImgView}>
            <Image
              source={Images.Share}
              tintColor={colors.appRed}
              style={styles.shareImg}
            />
          </TouchableOpacity>
          <GText
            SatoshiBold
            text={t('share_string')}
            style={styles.shareText}
          />
        </View>
      </View>
      <View style={styles.tagView}>
        <GText SatoshiBold text={'Puppies'} style={styles.tagText} />
        <View style={styles.pointer} />
        <GText SatoshiBold text={'How to'} style={styles.tagText} />
        <View style={styles.pointer} />
        <GText SatoshiBold text={'Joint Health'} style={styles.tagText} />
      </View>
      <View style={styles.titleView}>
        <GText
          SatoshiRegular
          text={'You want to give your puppy a warm welcome to their new home.'}
          style={styles.subTitleText}
        />
        <GText
          SatoshiRegular
          text={
            'However, buying for your puppy can be overwhelming when you don’t know where to begin.'
          }
          style={styles.subTitleText}
        />
        <GText
          SatoshiRegular
          text={
            'There are many things to know about caring for your new fur baby.'
          }
          style={styles.subTitleText}
        />
        <GText
          SatoshiRegular
          text={
            'So, let’s look at this checklist to help you in your preparations when bringing a new puppy home.'
          }
          style={styles.subTitleText}
        />
      </View>
      <View style={styles.establishRelationshipArticleView}>
        <GText
          GrMedium
          text={'Establish a Relationship With Your Veterinarian'}
          style={styles.secondTitleText}
        />
        <GText
          SatoshiRegular
          text={
            'Veterinary visits are crucial when it comes to caring for pets. Puppies should visit their veterinarian about every three to four weeks, says Dr. Efrem Hunter, DVM, MBA, a vet and Director of Veterinary and Scientific Affairs at Blue Buffalo.'
          }
          style={styles.subTitleText}
        />
        <GText
          SatoshiRegular
          text={
            'Chrissy Joy, a celebrity dog trainer and host of The Dog Moms, has four pups of her own. She says that the first few veterinary visits are critical, even for pups who come from healthy moms.'
          }
          style={styles.subTitleText}
        />
        <GText
          SatoshiRegular
          text={
            '“Meeting with your vet soon after bringing your puppy home is important,” she says. Puppies need essential vaccines that allow them to safely explore the outdoors and socialize with other pups. They’re also prone to parasites, which your vet can check for and quickly treat. Setting your puppy up with a qualified vet makes it easy to navigate their primary medical care. Consider these factors when choosing your vet:'
          }
          style={styles.subTitleText}
        />
      </View>

      <View style={styles.articleView}>
        <View style={styles.listItem}>
          <GText style={styles.bullet} text={'\u2022'} />
          <Text style={styles.listText}>
            <GText
              SatoshiBold
              style={styles.boldText}
              text={'Distance from home: '}
            />
            You don’t want to drive far for routine visits, and you’ll want to
            be able to get to the vet quickly in case of an emergency.
          </Text>
        </View>
        <View style={styles.listItem}>
          <GText style={styles.bullet} text={'\u2022'} />
          <Text style={styles.listText}>
            <GText
              SatoshiBold
              style={styles.boldText}
              text={'Services provided: '}
            />
            Make sure the vet offers the services you want, such as dental care,
            nutrition counselling, and spay and neuter surgeries. Having all
            services in one office can be a perk, though it’s not mandatory.
          </Text>
        </View>
        <View style={styles.listItem}>
          <GText style={styles.bullet} text={'\u2022'} />
          <Text style={styles.listText}>
            <GText SatoshiBold style={styles.boldText} text={'Experience: '} />
            Choose a vet who routinely works with your pet’s breed.
            Additionally, fear-free certified vets can prevent and
            reduce fear, anxiety, and stress in pets.
          </Text>
        </View>
        <View style={styles.listItem}>
          <GText style={styles.bullet} text={'\u2022'} />
          <Text style={styles.listText}>
            <GText SatoshiBold style={styles.boldText} text={'The space: '} />
            Ask whether you’re able to enter the examination room with your pet
            and if the office has separate waiting areas and rooms for cats and
            dogs, as this can help prevent potential conflicts and stress
            between our different furry friends.
          </Text>
        </View>

        <GText
          SatoshiRegular
          text={
            'In talking with your vet, you’ll quickly understand that preventative care is key to your pup’s well-being, including keeping vaccinations up to date and protecting your precious pooch against fleas, ticks, and heartworms.'
          }
          style={styles.subTitleText}
        />
      </View>
      <View style={styles.articleView}>
        <GText GrMedium text={'Puppy Food'} style={styles.titleText} />
        <GText
          SatoshiRegular
          text={
            'You’ll need to have plenty of high-quality puppy food on hand for your newly adopted pup.'
          }
          style={styles.subTitleText}
        />
        <GText
          SatoshiRegular
          text={
            'To help them power through their days, select a puppy food with a nutritional adequacy statement for growth or all life stages from the Association of American Feed Control Officials (AAFCO). You’ll find this info on the pet food label.'
          }
          style={styles.subTitleText}
        />
      </View>
      <View style={styles.puppyFeedingScheduleView}>
        <Image
          source={Images.puppyFeedingSchedules}
          style={styles.puppyFeedingImage}
        />
        <GText
          SatoshiRegular
          text={
            '“It’s always a good idea to ask your vet for nutritional counseling, to make sure your dog’s specific calorie requirements and other nutritional needs are being met,” Dr. Hunter says.'
          }
          style={styles.subTitleText}
        />
        <GText
          SatoshiRegular
          text={
            'If your puppy will be 50 pounds or more by adulthood, they may require large breed puppy food.'
          }
          style={styles.subTitleText}
        />
        <GText
          SatoshiBold
          text={'Here are a few recommended large breed puppy food brand: '}
          style={styles.foodBrandDesc}
        />
        <Image source={Images.petProductImage} style={styles.petProductImage} />
        <GText GrMedium text={'Conclusion'} style={styles.titleText} />
        <GText
          SatoshiRegular
          text={'Congratulations on your new puppy!'}
          style={styles.subTitleText}
        />
        <GText
          SatoshiRegular
          text={
            'This checklist will help you set the stage for a lifetime of love, joy, and cherished memories with your new best friend.'
          }
          style={styles.subTitleText}
        />
        <GText
          SatoshiRegular
          text={
            'While puppies are a lot of work, the time, energy, and budget you invest in your new furry family member using this checklist will give you all the tools you need to start your journey together.'
          }
          style={styles.subTitleText}
        />
        <Image source={Images.socialIconImage} style={styles.socialIconImage} />
        <GText
          GrMedium
          text={'Related Articles'}
          style={[styles.titleText, {marginBottom: scaledValue(12)}]}
        />
        <ArticleCard cardContainerStyle={{marginBottom: scaledValue(32)}} />
        <ArticleCard />
      </View>
    </ScrollView>
  );
};

export default BlogDetail;
