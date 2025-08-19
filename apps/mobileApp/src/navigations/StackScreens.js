import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import getScreenOptions from '../helpers/screenOptions';
import {useTranslation} from 'react-i18next';
import {
  Notifications,
  FAQ,
  FAQDetail,
  ContactUs,
  ParasiticideManagementHome,
  VaccineManagementHome,
  PainManagementHome,
  BookAppointmentHome,
  MedicalRecordHome,
  SharePetDutiesHome,
  ParasiticideRiskQuestion,
  ParasiticideQuestions2,
  ParasiticideReport,
  VaccineRecords,
  AddVaccineRecord,
  EditVaccineRecord,
  ExercisePlans,
  CreateNewPlan,
  IndividualExercises,
  NewExercisePlan,
  PostOpExercises,
  TreadMill,
  // NewExercisePlanStep2,
  PainJournal,
  NewPainAssessment,
  GrimaceScale,
  PainAssessment,
  PainScore,
  PainAssessmentScore,
  KnowledgeLibrary,
  ArticleDetail,
  BookAppointmentDetail,
  BookAppointmentDepartmentDetail,
  BookAppointment,
  SeePrescription,
  ChatScreen,
  BookAppointmentGroomer,
  AddNewDocument,
  DocumentListScreen,
  RecordPreview,
  AddNewTask,
  DiabetesManagement,
  AddNewRecord,
  AddNewRecord1,
  ViewRecord,
  ChooseVet,
  ChooseYourPet,
  AddPetDetails,
  MorePetDetails,
  BlogListing,
  BlogDetail,
  ContactVet,
  YearlySpendScreen,
  EditProfile,
  BusinessReview,
  PetSummary,
  AddBreederDetails,
  GroomerDetails,
  PetBoardingDetails,
  VeterinaryDetails,
  PetProfile,
  CreateFolder,
  Terms,
  Privacy,
  PetProfileList,
  ViewRecordFiles,
  FolderFilesList,
} from './screens';

const screens = [
  {name: 'Notifications', component: Notifications, title: 'Notifications'},
  {name: 'FAQ', component: FAQ, title: 'FAQs'},
  {name: 'FAQDetail', component: FAQDetail, title: 'FAQs'},
  {name: 'ContactUs', component: ContactUs, headerShown: false},
  {
    name: 'ParasiticideManagementHome',
    component: ParasiticideManagementHome,
    title: 'Parasiticide Management',
  },
  {
    name: 'VaccineManagementHome',
    component: VaccineManagementHome,
    title: 'Vaccination Management',
  },
  {
    name: 'PainManagementHome',
    component: PainManagementHome,
    titleKey: 'pain_assessment_string',
  },
  {
    name: 'BookAppointmentHome',
    component: BookAppointmentHome,
    title: 'Book an Appointment',
  },
  {
    name: 'MedicalRecordHome',
    component: MedicalRecordHome,
    title: 'Medical Records',
  },
  {
    name: 'ViewRecordFiles',
    component: ViewRecordFiles,
    title: 'Medical Records',
  },
  {
    name: 'CreateFolder',
    component: CreateFolder,
    titleKey: 'create_new_folder_string',
  },
  {
    name: 'SharePetDutiesHome',
    component: SharePetDutiesHome,
    title: 'Share Pet Duties',
  },
  {
    name: 'ParasiticideRiskQuestion',
    component: ParasiticideRiskQuestion,
    title: 'Parasiticide Risk Assessment',
  },
  {
    name: 'ParasiticideQuestions2',
    component: ParasiticideQuestions2,
    title: 'Parasiticide Risk Assessment',
  },
  {
    name: 'ParasiticideReport',
    component: ParasiticideReport,
    title: 'Assessment Report',
  },
  {
    name: 'VaccineRecords',
    component: VaccineRecords,
    title: 'Vaccination Records',
  },
  {
    name: 'AddVaccineRecord',
    component: AddVaccineRecord,
    title: 'New Vaccination Record',
  },
  {
    name: 'EditVaccineRecord',
    component: EditVaccineRecord,
    title: 'Edit Vaccination Record',
  },
  {
    name: 'ExercisePlans',
    component: ExercisePlans,
    titleKey: 'pain_assessment_string',
  },
  {name: 'CreateNewPlan', component: CreateNewPlan, title: 'Create New Plan'},
  {
    name: 'IndividualExercises',
    component: IndividualExercises,
    title: 'Individual Exercises',
  },
  {
    name: 'NewExercisePlan',
    component: NewExercisePlan,
    titleKey: 'pain_assessment_string',
  },
  {
    name: 'PostOpExercises',
    component: PostOpExercises,
    title: 'Post op Exercises',
  },
  {name: 'TreadMill', component: TreadMill, title: 'Treadmill'},
  // {
  //   name: 'NewExercisePlanStep2',
  //   component: NewExercisePlanStep2,
  //   title: 'Standard Exercise Plan',
  // },
  {name: 'PainJournal', component: PainJournal, title: 'Pain Assessment'},
  {
    name: 'NewPainAssessment',
    component: NewPainAssessment,
    title: 'New Pain Assessment',
  },
  {
    name: 'GrimaceScale',
    component: GrimaceScale,
    title: 'Feline Grimace Scale',
  },
  {name: 'PainAssessment', component: PainAssessment, title: 'Pain Assessment'},
  {name: 'PainScore', component: PainScore, title: 'Pain Score'},
  {
    name: 'PainAssessmentScore',
    component: PainAssessmentScore,
    title: 'Pain Score',
  },
  {
    name: 'KnowledgeLibrary',
    component: KnowledgeLibrary,
    title: 'Knowledge Library',
  },
  {name: 'ArticleDetail', component: ArticleDetail, headerShown: false},
  {
    name: 'BookAppointmentDetail',
    component: BookAppointmentDetail,
    title: 'Book an Appointment',
  },
  {name: 'BusinessReview', component: BusinessReview, title: 'Write a Review'},
  {
    name: 'BookAppointmentDepartmentDetail',
    component: BookAppointmentDepartmentDetail,
    title: '',
  },
  {
    name: 'BookAppointment',
    component: BookAppointment,
    title: 'Book an Appointment',
  },
  {name: 'SeePrescription', component: SeePrescription, title: 'Prescription'},
  {name: 'ChatScreen', component: ChatScreen, title: 'Dr. David Brown'},
  {
    name: 'BookAppointmentGroomer',
    component: BookAppointmentGroomer,
    title: 'Book an Appointment',
  },
  {name: 'AddNewDocument', component: AddNewDocument, title: 'Add New Record'},
  {
    name: 'PetSummary',
    component: PetSummary,
    titleKey: 'your_companions_string',
  },
  {
    name: 'DocumentListScreen',
    component: DocumentListScreen,
    title: 'Invoices',
  },
  {name: 'RecordPreview', component: RecordPreview, title: 'Invoices'},
  {name: 'AddNewTask', component: AddNewTask, title: 'Add New Task'},
  {
    name: 'DiabetesManagement',
    component: DiabetesManagement,
    title: 'Diabetes Management',
  },
  {name: 'AddNewRecord', component: AddNewRecord, title: 'Add New Record'},
  {name: 'AddNewRecord1', component: AddNewRecord1, title: 'Add New Record'},
  {name: 'ViewRecord', component: ViewRecord, title: '', headerShown: false},
  {name: 'ChooseVet', component: ChooseVet, title: 'Choose A Vet'},
  {name: 'ChooseYourPet', component: ChooseYourPet, title: ''},
  {
    name: 'AddPetDetails',
    component: AddPetDetails,
    titleKey: 'add_pet_details_string',
  },
  {
    name: 'MorePetDetails',
    component: MorePetDetails,
    title: 'More Pet Details',
  },
  {name: 'BlogListing', component: BlogListing, title: 'Paws & Insights'},
  {name: 'BlogDetail', component: BlogDetail, title: '', headerShown: false},
  {name: 'ContactVet', component: ContactVet, headerShown: false},
  {
    name: 'YearlySpendScreen',
    component: YearlySpendScreen,
    title: 'Yearly Spend',
  },
  {name: 'EditProfile', component: EditProfile, title: 'Edit Profile'},
  {name: 'PetProfile', component: PetProfile, title: 'Account'},
  {
    name: 'AddBreederDetails',
    component: AddBreederDetails,
    title: 'Add Breeder Details',
  },
  {name: 'GroomerDetails', component: GroomerDetails, title: 'Groomer Details'},
  {
    name: 'PetBoardingDetails',
    component: PetBoardingDetails,
    title: 'Pet Boarding Details',
  },
  {
    name: 'VeterinaryDetails',
    component: VeterinaryDetails,
    titleKey: 'add_vet_details_string',
  },
  {
    name: 'Terms',
    component: Terms,
    titleKey: 'terms_string',
  },
  {
    name: 'Privacy',
    component: Privacy,
    titleKey: 'privacy_string',
  },
  {
    name: 'PetProfileList',
    component: PetProfileList,
    titleKey: 'your_companions_string',
  },
  {
    name: 'FolderFilesList',
    component: FolderFilesList,
    titleKey: 'FolderFilesList',
  },

  ,
];

const StackScreens = () => {
  const Stack = createNativeStackNavigator();
  const {t} = useTranslation();

  return (
    <Stack.Navigator>
      {screens.map(({name, component, title, headerShown, titleKey}) => (
        <Stack.Screen
          key={name}
          name={name}
          component={component}
          options={props =>
            getScreenOptions({
              ...props,
              title: titleKey ? t(titleKey) : title || '',
              headerShown: headerShown !== undefined ? headerShown : true,
            })
          }
        />
      ))}
    </Stack.Navigator>
  );
};

export default StackScreens;
