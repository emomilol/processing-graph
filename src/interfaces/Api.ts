import GraphServerClient from './GraphServerClient';
import { ObjectSchema } from 'joi';


export default abstract class Api extends GraphServerClient {
  protected schema: ObjectSchema | undefined;
  protected abstract createAPI(): void;

  setSchema( schema: ObjectSchema ) {
    this.schema = schema;
  }
}
