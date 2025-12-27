import { MutableRefObject, useEffect } from 'react';

const listenerCallbacks = new WeakMap();

let observer: IntersectionObserver;

const handleIntersections = (entries: IntersectionObserverEntry[]) => {
  entries.forEach((entry) => {
    if (listenerCallbacks.has(entry.target)) {
      const cb = listenerCallbacks.get(entry.target);

      if (entry.isIntersecting || entry.intersectionRatio > 0) {
        observer.unobserve(entry.target);
        listenerCallbacks.delete(entry.target);
        cb();
      }
    }
  });
};

export const getIntersectionObserver = () => {
  if (observer === undefined) {
    observer = new IntersectionObserver(handleIntersections, {
      rootMargin: '100px',
      threshold: 0.15,
    });
  }
  return observer;
};

export const useIntersection = (elem: MutableRefObject<Element | null>, callback: any) => {
  useEffect(() => {
    if (!elem.current) return undefined;
    const target = elem.current;
    const o = getIntersectionObserver();
    listenerCallbacks.set(target, callback);
    o.observe(target);

    return () => {
      listenerCallbacks.delete(target);
      o.unobserve(target);
    };
  }, [elem, callback]);
};
