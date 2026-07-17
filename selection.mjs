const SNAP_RADIUS = 36;
const MAX_CANDIDATES = 600;

function isElementLike(value) {
  if (typeof Element !== "undefined" && value instanceof Element) {
    return true;
  }
  if (typeof HTMLElement !== "undefined" && value instanceof HTMLElement) {
    return true;
  }
  return Boolean(value?.tagName && value?.getBoundingClientRect);
}

function isOverlayElement(element) {
  return Boolean(element?.closest?.("[data-ui-reference-copier='true']"));
}

function rectArea(rect) {
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

function isVisibleRect(rect) {
  return rect.width > 0 && rect.height > 0;
}

function isSelectable(element) {
  if (!isElementLike(element)) {
    return false;
  }
  if (element === globalThis.document?.documentElement || element === globalThis.document?.body) {
    return false;
  }
  if (isOverlayElement(element)) {
    return false;
  }
  return isVisibleRect(element.getBoundingClientRect());
}

function closestSelectableAncestor(target) {
  let current = isElementLike(target) ? target : null;
  while (current && !isSelectable(current)) {
    current = current.parentElement;
  }
  return current;
}

export function selectableParent(element) {
  return closestSelectableAncestor(element?.parentElement) ?? null;
}

function distanceToRect(point, rect) {
  const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
  const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
  return Math.hypot(dx, dy);
}

function collectSelectableDescendants(container) {
  return Array.from(container.querySelectorAll?.("*") ?? [])
    .slice(0, MAX_CANDIDATES)
    .filter((item) => item !== container && isSelectable(item));
}

function nearestDescendant(container, point) {
  let best = null;
  let bestScore = Infinity;

  collectSelectableDescendants(container).forEach((candidate) => {
    const rect = candidate.getBoundingClientRect();
    const distance = distanceToRect(point, rect);
    if (distance > SNAP_RADIUS) {
      return;
    }

    const score = distance * 1000 + rectArea(rect) * 0.001;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  });

  return best;
}

export function resolveSelectableElement(target, point = null, options = {}) {
  const base = closestSelectableAncestor(target);
  if (!base || !point) {
    return options.preferParent ? selectableParent(base) ?? base : base;
  }

  const nearest = nearestDescendant(base, point);
  if (!nearest) {
    return options.preferParent ? selectableParent(base) ?? base : base;
  }

  const baseArea = rectArea(base.getBoundingClientRect());
  const nearestArea = rectArea(nearest.getBoundingClientRect());
  const resolved = baseArea > nearestArea * 1.8 ? nearest : base;
  return options.preferParent ? selectableParent(resolved) ?? resolved : resolved;
}
