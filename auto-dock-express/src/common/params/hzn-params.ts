import { ApiParams } from "./api-params";

export interface HznParams extends ApiParams {
  type: string;
  id: string;
  object: string;
  pattern: string;
  url: string;
}