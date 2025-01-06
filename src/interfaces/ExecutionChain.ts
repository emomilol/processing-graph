export default abstract class ExecutionChain {
  protected next: ExecutionChain | undefined;
  protected previous: ExecutionChain | undefined;
  public abstract report( message: string, data: any ): void;

  public setNext( next: ExecutionChain ): void {
    if ( this.hasNext ) {
      return;
    }

    next.previous = this
    this.next = next;
  };

  get hasNext() {
    return !!this.next;
  }

  get hasPreceding() {
    return !!this.previous;
  }

  getNext() {
    return this.next;
  }

  getPreceding() {
    return this.previous;
  }

  decouple() {
    this.next = undefined;
    this.previous = undefined;
  }
}
