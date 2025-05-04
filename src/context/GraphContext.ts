import { v4 as uuid } from 'uuid';
import { deepClone } from '../utils/tools';
import { AnyObject } from '../types/global';
import GraphContextFactory from './GraphContextFactory';

export default class GraphContext {
  readonly id: string;
  private readonly context: any | any[];

  constructor( context: any ) {
    this.context = context;
    this.id = uuid();
  }

  getContext() {
    return this.removeMetaData( this.context );
  }

  getFullContext() {
    return this.context;
  }

  getMetaData() {
    if ( Array.isArray( this.context ) ) {
      return deepClone( this.context[ 0 ], ( key: string ) => !key.startsWith( '__' ) );
    }

    return deepClone( this.context, ( key: string ) => !key.startsWith( '__' ) );
  }

  clone() {
    return this.mutate( this );
  }

  mutate( context: any ) {
    if ( context instanceof GraphContext ) {
      return GraphContextFactory.instance.newContext( deepClone( context.getFullContext() ) );
    }

    return GraphContextFactory.instance.newContext( context );
  }

  combine( otherContext: GraphContext ) {
    let newContext;
    if ( !Array.isArray( this.context ) ) {
      newContext = [ this.context, otherContext.clone().getFullContext() ];

    } else {
      newContext = this.context;
      newContext.push( otherContext.clone().getFullContext() );
    }

    return this.mutate( newContext );
  }

  export() {
    return {
      __id: this.id,
      __context: this.getContext(),
    };
  }

  // private deepFreeze( object: any ) {
  //   // Retrieve the property names defined on object
  //   const propNames = Reflect.ownKeys( object );
  //
  //   // Freeze properties before freezing self
  //   for ( const name of propNames ) {
  //     const value = object[ name ];
  //
  //     if ( ( value && typeof value === 'object' ) || typeof value === 'function' ) {
  //       this.deepFreeze( value );
  //     }
  //   }
  //
  //   return Object.freeze( object );
  // }

  private removeMetaData( context: AnyObject ) {
    return deepClone( context, ( key ) => key.startsWith( '__' ) );
  }
}
