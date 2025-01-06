import GraphRunState from '../interfaces/GraphRunState';


export default class GraphStandardRun extends GraphRunState {
  run() {
    this.graphBuilder.compose();
    this.updateContext();
    this.reset();
  }

  export(): any {
    return {};
  }
}