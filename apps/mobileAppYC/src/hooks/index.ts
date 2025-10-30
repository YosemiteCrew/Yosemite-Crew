export * from '@/shared/hooks';
export {useSocialAuth} from '@/features/auth/hooks/useSocialAuth';
export {useDocumentFormValidation} from '@/features/documents/hooks/useDocumentFormValidation';
export {useTaskFormState} from '@/features/tasks/hooks/useTaskFormState';
export {useTaskFormSheets} from '@/features/tasks/hooks/useTaskFormSheets';
export {useAppDispatch, useAppSelector} from '@/app/hooks';

export type {SocialProvider} from '@/features/auth/hooks/useSocialAuth';
