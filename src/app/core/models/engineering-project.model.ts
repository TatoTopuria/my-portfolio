export type EngineeringProjectType =
  | 'Microservice'
  | 'Enterprise Web Platform'
  | 'Desktop Platform'
  | 'Shared Platform';

export interface EngineeringProject {
  id: string;
  name: string;
  sourceFile: string;
  type: EngineeringProjectType;
  domain: string;
  architecture: string;
  stack: string[];
  integrations: string[];
  scale: string[];
  impact: string;
}
