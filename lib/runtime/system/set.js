// ==========================================================================
// Project:   SproutCore Costello - Property Observing Library
// Copyright: ©2006-2009 Sprout Systems, Inc. and contributors.
//            Portions ©2008-2009 Apple Inc. All rights reserved.
// License:   Licensed under MIT license (see license.js)
// ==========================================================================

//sc_require('mixins/enumerable') ;
//sc_require('mixins/observable') ;
//sc_require('mixins/freezable');
//sc_require('mixins/copyable');

var SC = module.parent.SC;

// IMPORTANT NOTE:  This file actually defines two classes: 
// SC.Set is a fully observable set class documented below. 
// SC._CoreSet is just like SC.Set but is not observable.  This is required
// because SC.Observable is built on using sets and requires sets without 
// observability.
//
// We use pointer swizzling below to swap around the actual definitions so 
// that the documentation will turn out right.  (The docs should only 
// define SC.Set - not SC._CoreSet)

/**
  @class 

  An unordered collection of objects.

  A Set works a bit like an array except that its items are not ordered.  
  You can create a set to efficiently test for membership for an object. You 
  can also iterate through a set just like an array, even accessing objects
  by index, however there is no gaurantee as to their order.

  Note that SC.Set is a primitive object, like an array.  It does implement
  limited key-value observing support but it does not extend from SC.Object
  so you should not subclass it.

  h1. Creating a Set

  You can create a set like you would most objects using SC.Set.create().  
  Most new sets you create will be empty, but you can also initialize the set 
  with some content by passing an array or other enumerable of objects to the 
  constructor.

  Finally, you can pass in an existing set and the set will be copied.  You
  can also create a copy of a set by calling SC.Set#clone().

  {{{
    // creates a new empty set
    var foundNames = SC.Set.create();

    // creates a set with four names in it.
    var names = SC.Set.create(["Charles", "Peter", "Chris", "Erich"]) ;

    // creates a copy of the names set.
    var namesCopy = SC.Set.create(names);

    // same as above.
    var anotherNamesCopy = names.clone();
  }}}

  h1. Adding/Removing Objects

  You generally add or removed objects from a set using add() or remove().
  You can add any type of object including primitives such as numbers,
  strings, and booleans.

  Note that objects can only exist one time in a set.  If you call add() on
  a set with the same object multiple times, the object will only be added 
  once.  Likewise, calling remove() with the same object multiple times will
  remove the object the first time and have no effect on future calls until 
  you add the object to the set again.

  Note that you cannot add/remove null or undefined to a set.  Any attempt to
  do so will be ignored.  

  In addition to add/remove you can also call push()/pop().  Push behaves just
  like add() but pop(), unlike remove() will pick an arbitrary object, remove
  it and return it.  This is a good way to use a set as a job queue when you
  don't care which order the jobs are executed in.

  h1. Testing for an Object

  To test for an object's presence in a set you simply call SC.Set#contains().
  This method tests for the object's hash, which is generally the same as the
  object's _guid but if you implement the hash() method on the object, it will
  use the return value from that method instead.

  @extends SC.Enumerable 
  @extends SC.Observable
  @extends SC.Copyable
  @extends SC.Freezable

  @since SproutCore 1.0
*/
SC.Set = SC.mixin({}, 
  SC.Enumerable, 
  SC.Observable, 
  SC.Freezable, 
/** @scope SC.Set.prototype */ {

  /** 
    Creates a new set, with the optional array of items included in the 
    return set.

    @param {SC.Enumerable} items items to add
    @return {SC.Set}
  */
  create: function(items) {
    var ret, idx, pool = SC.Set._pool, isObservable = this.isObservable;
    if (!isObservable && items===undefined && pool.length>0) ret = pool.pop();
    else {
      ret = SC.beget(this);
      if (isObservable) ret.initObservable();
      
      if (items && items.isEnumerable && items.get('length')>0) {

        ret.isObservable = false; // suspend change notifications
        
        // arrays and sets get special treatment to make them a bit faster
        if (items.isSCArray) {
          idx = items.get ? items.get('length') : items.length;
          while(--idx>=0) ret.add(items.objectAt(idx));
        
        } else if (items.isSet) {
          idx = items.length;
          while(--idx>=0) ret.add(items[idx]);
          
        // otherwise use standard SC.Enumerable API
        } else items.forEach(function(i) { ret.add(i); }, this);
        
        ret.isObservable = isObservable;
      }
    }
    return ret ;
  },
  
  /**
    Walk like a duck
    
    @property {Boolean}
  */
  isSet: true,
  
  /**
    This property will change as the number of objects in the set changes.

    @property {Number}
  */
  length: 0,

  /**
    Returns the first object in the set or null if the set is empty
    
    @property {Object}
  */
  firstObject: function() {
    return (this.length>0) ? this[0] : undefined ;
  }.property(),
  
  /**
    Clears the set 
    
    @returns {SC.Set}
  */
  clear: function() { 
    if (this.isFrozen) throw SC.FROZEN_ERROR;
    this.length = 0;
    return this ;
  },

  /**
    Call this method to test for membership.
    
    @returns {Boolean}
  */
  contains: function(obj) {

    // because of the way a set is "reset", the guid for an object may 
    // still be stored as a key, but points to an index that is beyond the
    // length.  Therefore the found idx must both be defined and less than
    // the current length.
    if (obj === null) return false ;
    var idx = this[SC.hashFor(obj)] ;
    return (!SC.none(idx) && (idx < this.length) && (this[idx]===obj)) ;
  },
  
  /**
    Returns true if the passed object is also a set that contains the same 
    objects as the receiver.
  
    @param {SC.Set} obj the other object
    @returns {Boolean}
  */
  isEqual: function(obj) {
    // fail fast
    if (!obj || !obj.isSet || (obj.get('length') !== this.get('length'))) {
      return false ;
    }
    
    var loc = this.get('length');
    while(--loc>=0) {
      if (!obj.contains(this[loc])) return false ;
    }
    
    return true;
  },

  /**
    Call this method to add an object. performs a basic add.

    If the object is already in the set it will not be added again.

    @param obj {Object} the object to add
    @returns {SC.Set} receiver
  */
  add: function(obj) {
    if (this.isFrozen) throw SC.FROZEN_ERROR;
    
    // cannot add null to a set.
    if (obj===null || obj===undefined) return this; 

    var guid = SC.hashFor(obj) ;
    var idx = this[guid] ;
    var len = this.length ;
    if ((idx===null || idx===undefined) || (idx >= len) || (this[idx]!==obj)){
      this[len] = obj ;
      this[guid] = len ;
      this.length = len+1;
    }
    
    if (this.isObservable) this.enumerableContentDidChange();
    
    return this ;
  },

  /**
    Add all the items in the passed array or enumerable

    @returns {SC.Set} receiver
  */
  addEach: function(objects) {
    if (this.isFrozen) throw SC.FROZEN_ERROR;
    if (!objects || !objects.isEnumerable) {
      throw "%@.addEach must pass enumerable".fmt(this);
    }

    var idx, isObservable = this.isObservable ;
    
    if (isObservable) this.beginPropertyChanges();
    if (objects.isSCArray) {
      idx = objects.get('length');
      while(--idx >= 0) this.add(objects.objectAt(idx)) ;
    } else if (objects.isSet) {
      idx = objects.length;
      while(--idx>=0) this.add(objects[idx]);
      
    } else objects.forEach(function(i) { this.add(i); }, this);
    if (isObservable) this.endPropertyChanges();
    
    return this ;
  },  

  /**
    Removes the object from the set if it is found.

    If the object is not in the set, nothing will be changed.

    @param obj {Object} the object to remove
    @returns {SC.Set} receiver
  */  
  remove: function(obj) {
    if (this.isFrozen) throw SC.FROZEN_ERROR;

    if (SC.none(obj)) return this ;
    var guid = SC.hashFor(obj);
    var idx = this[guid] ;
    var len = this.length;

    // not in set.
    if (SC.none(idx) || (idx >= len) || (this[idx] !== obj)) return this; 

    // clear the guid key
    delete this[guid] ;

    // to clear the index, we will swap the object stored in the last index.
    // if this is the last object, just reduce the length.
    if (idx < (len-1)) {
      obj = this[idx] = this[len-1];
      this[SC.hashFor(obj)] = idx ;
    }

    // reduce the length
    this.length = len-1;
    if (this.isObservable) this.enumerableContentDidChange();
    return this ;
  },

  /**
    Removes an arbitrary object from the set and returns it.

    @returns {Object} an object from the set or null
  */
  pop: function() {
    if (this.isFrozen) throw SC.FROZEN_ERROR;
    var obj = (this.length > 0) ? this[this.length-1] : null ;
    if (obj) this.remove(obj) ;
    return obj ;
  },

  /**
    Removes all the items in the passed array.

    @returns {SC.Set} receiver
  */
  removeEach: function(objects) {
    if (this.isFrozen) throw SC.FROZEN_ERROR;
    if (!objects || !objects.isEnumerable) {
      throw "%@.addEach must pass enumerable".fmt(this);
    }

    var idx, isObservable = this.isObservable ;
    
    if (isObservable) this.beginPropertyChanges();
    if (objects.isSCArray) {
      idx = objects.get('length');
      while(--idx >= 0) this.remove(objects.objectAt(idx)) ;
    } else if (objects.isSet) {
      idx = objects.length;
      while(--idx>=0) this.remove(objects[idx]);
    } else objects.forEach(function(i) { this.remove(i); }, this);
    if (isObservable) this.endPropertyChanges();
    
    return this ;
  },  

  /**
   Clones the set into a new set.  

    @returns {SC.Set} new copy
  */
  copy: function() {
    return this.constructor.create(this);    
  },

  /**
    Return a set to the pool for reallocation.

    @returns {SC.Set} receiver
  */
  destroy: function() {
    this.isFrozen = false ; // unfreeze to return to pool
    if (!this.isObservable) SC.Set._pool.push(this.clear());
    return this;
  },
  
  // .......................................
  // PRIVATE 
  //

  /** @private - optimized */
  forEach: function(iterator, target) {
    var len = this.length;
    if (!target) target = this ;
    for(var idx=0;idx<len;idx++) iterator.call(target, this[idx], idx, this);
    return this ;
  },

  /** @private */
  toString: function() {
    var len = this.length, idx, ary = [];
    for(idx=0;idx<len;idx++) ary[idx] = this[idx];
    return "SC.Set<%@>".fmt(ary.join(',')) ;
  },
  
  // the pool used for non-observable sets
  _pool: [],

  /** @private */
  isObservable: true

}) ;

SC.Set.constructor = SC.Set;

// Make SC.Set look a bit more like other enumerables

/** @private */
SC.Set.clone = SC.Set.copy ;

/** @private */
SC.Set.push = SC.Set.unshift = SC.Set.add ;

/** @private */
SC.Set.shift = SC.Set.pop ;

// add generic add/remove enumerable support

/** @private */
SC.Set.addObject = SC.Set.add ;

/** @private */
SC.Set.removeObject = SC.Set.remove;

SC.Set._pool = [];

// ..........................................................
// CORE SET
// 

/** @class

  CoreSet is just like set but not observable.  If you want to use the set 
  as a simple data structure with no observing, CoreSet is slightly faster
  and more memory efficient.
  
  @extends SC.Set
  @since SproutCore 1.0
*/
SC.CoreSet = SC.beget(SC.Set);

/** @private */
SC.CoreSet.isObservable = false ;

/** @private */
SC.CoreSet.constructor = SC.CoreSet;
