import type { ComponentType } from 'react';
import type { IconType } from 'react-icons';

export type ExtensionPointId =
  | 'appointment.workspace.sideModal.panels'
  | 'appointment.workspace.actionRail.items'
  | 'appointment.workspace.steps'
  | 'appointment.workspace.header.actions'
  | 'forms.list.actions'
  | 'forms.builder.fields'
  | 'forms.detail.tabs'
  | 'forms.detail.actions';

export type ExtensionContext =
  | { type: 'appointment'; appointmentId: string; organisationId: string }
  | { type: 'forms'; formId?: string; organisationId: string }
  | { type: 'forms.list'; organisationId: string };

export interface ExtensionPoint<TPayload = unknown> {
  id: ExtensionPointId;
  label: string;
  description: string;
  payload?: TPayload;
}

export interface PluginExtension<TProps = Record<string, unknown>> {
  id: string;
  extensionPointId: ExtensionPointId;
  component: ComponentType<TProps> & { icon?: IconType; displayName?: string };
  priority?: number;
  when?: (context: ExtensionContext) => boolean;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  extensions: PluginExtension[];
  permissions?: string[];
}

export interface RegisteredExtension<TProps = Record<string, unknown>> {
  pluginId: string;
  pluginName: string;
  extension: PluginExtension<TProps>;
}

export interface UseExtensionPointResult<TProps = Record<string, unknown>> {
  extensions: RegisteredExtension<TProps>[];
  ExtensionComponents: ComponentType<TProps>[];
}

export type AppointmentWorkspaceSideModalPanelExtension = PluginExtension<{
  appointmentId: string;
  organisationId: string;
  onClose: () => void;
}>;

export type AppointmentWorkspaceActionRailItemExtension = PluginExtension<{
  appointmentId: string;
  organisationId: string;
  onAction: () => void;
}>;

export type AppointmentWorkspaceStepExtension = PluginExtension<{
  appointmentId: string;
  organisationId: string;
  encounter: import('@/app/features/appointments/types/workspace').AppointmentEncounter;
}>;

export type FormBuilderFieldExtension = PluginExtension<{
  formId?: string;
  organisationId: string;
  field: import('@/app/features/forms/types/forms').FormField;
  onChange: (field: import('@/app/features/forms/types/forms').FormField) => void;
}>;

export type FormsListActionExtension = PluginExtension<{
  organisationId: string;
  onAction: (forms: import('@/app/features/forms/types/forms').FormsProps[]) => void;
}>;

export type FormDetailTabExtension = PluginExtension<{
  formId: string;
  organisationId: string;
  form: import('@/app/features/forms/types/forms').FormsProps;
}>;

export type FormDetailActionExtension = PluginExtension<{
  formId: string;
  organisationId: string;
  form: import('@/app/features/forms/types/forms').FormsProps;
  onAction: () => void;
}>;

export type ExtensionPointComponents = {
  'appointment.workspace.sideModal.panels': AppointmentWorkspaceSideModalPanelExtension[];
  'appointment.workspace.actionRail.items': AppointmentWorkspaceActionRailItemExtension[];
  'appointment.workspace.steps': AppointmentWorkspaceStepExtension[];
  'forms.list.actions': FormsListActionExtension[];
  'forms.builder.fields': FormBuilderFieldExtension[];
  'forms.detail.tabs': FormDetailTabExtension[];
  'forms.detail.actions': FormDetailActionExtension[];
};

export type ExtensionPointComponentMap = {
  [K in ExtensionPointId]: PluginExtension<any>[];
};
