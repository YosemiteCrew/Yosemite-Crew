import { Resource } from './Resource';

export type ResourceType = Resource['resourceType'];
export type ExtractResource<K extends ResourceType> = Extract<Resource, { resourceType: K }>;