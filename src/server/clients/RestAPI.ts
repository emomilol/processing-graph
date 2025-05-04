import express, { Express, Request, Response } from 'express';
import GraphServer from '../GraphServer';
import Api from '../../interfaces/Api';
import { v4 as uuid } from 'uuid';
import { AnyObject } from '../../types/global';
import helmet from 'helmet';
import cors from 'cors';
import GraphRegistry from '../GraphRegistry';
import GraphContextFactory from '../../context/GraphContextFactory';
// import rateLimit from 'express-rate-limit';


// The REST API is the gateway to this graph and to the whole network of graphs from outside sources.
// It is also used to initiate graph executions (runs).
export default class RestAPI extends Api {
  private static instance_: RestAPI;

  static get instance() {
    if ( !this.instance_ ) {
      this.instance_ = new RestAPI();
    }

    return this.instance_;
  }

  private readonly app: Express;
  private idToResponse: { [ key: string ]: Response } = {};

  protected constructor() {
    super();
    this.app = express();
    // Secure the server with Helmet
    this.app.use( helmet() );
    // Enable CORS with strict policies
    this.app.use( cors( {
      origin: [ 'http://localhost:3000' ], // Allow only specific origins
      methods: [ 'GET', 'POST' ], // Allow only specific methods
      allowedHeaders: [ 'Content-Type' ],
    } ) );
    // Rate limiting to prevent brute-force attacks
    // const limiter = rateLimit( {
    //   windowMs: 15 * 60 * 1000, // 15 minutes
    //   limit: 100, // Limit each IP to 100 requests per window
    // } );
    // this.app.use( limiter );
    // JSON body parser middleware
    this.app.use( express.json() );
    // Input validation schemas using Joi

    this.createAPI();
  }

  protected createAPI() {
    this.app.post( '/api/run_graph', this.runGraph.bind( this ) );
    this.app.get( '/api/status', this.getStatus.bind( this ) );
  }

  connectToServer( server: GraphServer ) {
    super.connectToServer( server );
    server.createServer( this.app );
  }

  dispatch( data: AnyObject, action: string = 'json' ) {
    const context = GraphContextFactory.instance.getContextById( data.__context.__id );
    const metaData = context.getMetaData();
    const response = this.idToResponse[ metaData.__responseId ];
    if ( response ) {
      const contextData = context.getContext();
      const responseData = { ...contextData, ...( metaData.__metaData ?? metaData ) };
      ( response as any )[ action ]( responseData ); // TODO typing
      delete this.idToResponse[ metaData.__responseId ];
      this.forwardToServer( 'Responded to request', responseData );
    }
  }

  private runGraph( req: Request, res: Response ) {
    if ( this.schema ) {
      const { error } = this.schema.validate( req.body );
      if ( error ) return res.status( 400 ).json( { __error: error.details[0].message } ); // TODO dont send the error message in production
    }

    if ( !req.body.__forceRun && GraphRegistry.instance.checkSelf() ) {
      this.forwardToServer( 'Overloaded', req.body );
      return;
    }

    const data = this.getData( req, res );
    this.forwardToServer( 'Run Graph', data );
  }

  private getStatus( _: Request, res: Response ) {
    const status = GraphRegistry.instance.getSelfStatus();
    res.json( status );
  }

  private getData( req: Request, res: Response ) {
    const id = req.body.__graphId ?? uuid();
    this.idToResponse[ id ] = res;
    return { ...req.body, __responseId: id };
  }
}
