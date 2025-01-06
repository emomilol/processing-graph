import GraphContext from './GraphContext';
import { AnyObject } from '../../types/global';

export default class GraphContextFactory {
  private cache: { [ value: string | number ]: Set<GraphContext> } = {};
  private objectIdCache = new WeakMap();
  private idToContext: { [ id: string ]: GraphContext } = {};
  private objectCount = 0;
  private static _instance: GraphContextFactory;

  public static get instance() {
    if ( !this._instance ) {
      this._instance = new GraphContextFactory();
    }

    return this._instance;
  }

  private constructor() {}

  public reset() {
    this.cache = {};
    this.objectIdCache = new WeakMap<object, any>();
    this.idToContext = {};
    this.objectCount = 0;
  }

  public newContext( context: any ) {
    const instance = new GraphContext( context );
    this.registerContext( context, instance );
    return instance;
  }

  public getContext( context: any ) {
    const cached =  this.searchForMatchingContext( context );

    if ( !cached ) {
      return this.newContext( context );
    }

    return cached;
  }

  public getContextById( id: string ) {
    return this.idToContext[ id ];
  }

  private registerContext( context: any, instance: GraphContext ) {
    this.idToContext[ instance.id ] = instance;

    if ( Array.isArray( context ) ) {
      this.registerObject( context, instance );

    } else if ( context instanceof Object ) {
      this.registerObject( context, instance );

      for ( const key of Object.keys( context ) ) {
        const value = context[ key ];

        if ( value?.__id ) {
          this.addToCache( value.__id, instance );

        } else if ( typeof value === 'string' || typeof value === 'boolean' ) {
          this.addToCache( `${ key }-${ value }`, instance );

        } else if ( value instanceof Object ) {
          this.registerObject( value, instance );

          for ( const k of Object.keys( value ) ) {
            const v = value[ k ];

            if ( typeof v === 'string' || typeof value === 'boolean' ) {
              this.addToCache( `${ k }-${ v }`, instance );
            }
          }
        }
      }

    } else if ( typeof context === 'string' ) {
      this.addToCache( context, instance );
    }
  }

  private addToCache( key: string | number, instance: GraphContext ) {
    if ( !this.cache[ key ] ) {
      this.cache[ key ] = new Set();
    }

    this.cache[ key ].add( instance );
  }

  private registerObject( object: AnyObject, instance: GraphContext ) {
    if ( !this.objectIdCache.has( object ) ) {
      this.objectIdCache.set( object, this.objectCount++ );
      this.addToCache( this.objectCount, instance );
    }
  }

  private searchForMatchingContext( context: any, result: Set<GraphContext> = new Set() ) {
    if ( Array.isArray( context ) ) {
      if ( this.objectIdCache.has( context ) ) {
        this.updateResult( result, this.cache[ this.objectIdCache.get( context ) ] );
      }

    } else if ( context instanceof Object ) {
      if ( this.objectIdCache.has( context ) ) {
        this.updateResult( result, this.cache[ this.objectIdCache.get( context ) ] );

      } else {
        for ( const key of Object.keys( context ) ) {
          const value = context[ key ];

          if ( value?.__id && this.cache[ value.__id ] ) {
            this.updateResult( result, this.cache[ value.__id ] );
            continue;

          } else if ( ( typeof value === 'string' || typeof value === 'boolean' ) && this.cache[ `${ key }-${ value }` ] ) {
            this.updateResult( result, this.cache[ `${ key }-${ value }` ] );
            continue;

          } else if ( value instanceof Object ) {
            if ( this.objectIdCache.has( value ) ) {
              this.updateResult( result, this.cache[ this.objectIdCache.get( value ) ] );
              continue;

            } else {
              for ( const k of Object.keys( value ) ) {
                const v = value[ k ];

                if ( typeof v === 'string' || typeof value === 'boolean' ) {
                  if ( this.cache[ `${ k }-${ v }` ] ) {
                    this.updateResult( result, this.cache[ `${ k }-${ v }` ] );
                    continue;
                  }

                  return;
                }
              }
            }
          }

          return;
        }
      }

    } else if ( this.cache[ context ] ) {
      this.updateResult( result, this.cache[ context ] );
    }

    if ( result.size === 1 ) {
      return result.values().next().value;
    }
  }

  private updateResult( result: Set<GraphContext>, set: Set<GraphContext> ) {
    if ( result.size === 0 ) {
      set.forEach( key => result.add( key ) );

    } else {
      result.forEach( key => {
        if ( !set.has( key ) ) {
          result.delete( key );
        }
      } );
    }
  }
}
