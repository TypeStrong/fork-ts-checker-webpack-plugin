export class HeadNode<T> {
  public next: LinkedListNode<T> | TailNode<T>;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    this.next = new TailNode(this);
  }
}

export class TailNode<T> {
  public previous: LinkedListNode<T> | HeadNode<T>;

  constructor(head: HeadNode<T>) {
    this.previous = head;
  }
}
export class LinkedListNode<T> {
  public next: LinkedListNode<T> | TailNode<T> | null = null;
  public previous: LinkedListNode<T> | HeadNode<T> | null = null;
  public readonly item: T;

  constructor(item: T) {
    this.item = item;
  }

  public detachSelf() {
    if (!this.next && !this.previous) {
      throw new Error('node is not attached');
    }
    if (this.next) {
      this.next.previous = this.previous;
    }
    if (this.previous) {
      this.previous.next = this.next;
    }
    this.next = null;
    this.previous = null;
  }

  public attachAfter(node: LinkedListNode<T> | HeadNode<T>) {
    if (this.next || this.previous) {
      throw new Error('Node is inserted elsewhere');
    }

    this.next = node.next;
    this.previous = node;

    if (node.next) {
      node.next.previous = this;
    }
    node.next = this;
  }

  public attachBefore(node: LinkedListNode<T> | TailNode<T>) {
    if (!node.previous) {
      throw new Error('no previous node found.');
    }
    this.attachAfter(node.previous);
  }
}
export class LinkedList<T> {
  public head: HeadNode<T>;
  public tail: TailNode<T>;

  constructor() {
    this.head = new HeadNode<T>();
    this.tail = this.head.next as TailNode<T>;
  }

  public add(item: T): LinkedListNode<T> {
    const newNode = new LinkedListNode(item);
    newNode.attachAfter(this.tail.previous);
    return newNode;
  }

  public getItems(): T[] {
    const result: T[] = [];
    this.forEach(item => {
      result.push(item);
    });
    return result;
  }

  public forEach(callback: (item: T, node: LinkedListNode<T>) => void) {
    let current = this.head.next;
    while (current !== this.tail) {
      // if item is not tail it is always a node
      const item = current as LinkedListNode<T>;
      callback(item.item, item);
      if (!item.next) {
        throw new Error('badly attached item found.');
      }
      current = item.next;
    }
  }

  public hasItems() {
    return this.head.next !== this.tail;
  }

  public getLastItem() {
    if (!this.hasItems()) {
      throw new Error('no items in list.');
    }
    return this.head.next as LinkedListNode<T>;
  }
}
