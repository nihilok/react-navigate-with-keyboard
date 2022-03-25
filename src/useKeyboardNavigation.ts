import * as React from 'react';

type ClassName = string;

type ReactRefObject = React.MutableRefObject<any>;

type Container = ReactRefObject | string;

type AutoSelect = boolean | { [index: number]: boolean };

type ContainerIndexSetter = React.Dispatch<React.SetStateAction<number>>;

type AllowedSelectors =
  | 'a'
  | 'button'
  | 'input'
  | '[href]'
  | 'select'
  | 'textarea'
  | '[tabindex]:not([tabindex="-1"])'
  | ClassName;

interface Options {
  selectors?: AllowedSelectors | AllowedSelectors[];
  autoSelect?: AutoSelect;
  tabKeyContainerLevel?: boolean;
  selectedClassName?: ClassName;
}

const SELECTED_CLASSNAME = 'selected';

export const allSelectors: AllowedSelectors[] = [
  'a',
  'button',
  '[href]',
  'input',
  'select',
  'textarea',
  '[tabindex]:not([tabindex="-1"])',
];

export function parseSelectors(
  unParsedSelectors: AllowedSelectors | AllowedSelectors[],
) {
  // Selectors can be passed as a string, or an Array of strings. In the latter case
  // they will be concatenated into a comma-separated string.
  return Array.isArray(unParsedSelectors)
    ? unParsedSelectors.join(',')
    : unParsedSelectors;
}

function getFocusableElements(container: Element, selectors: string) {
  // Get all focusable elements within the given element
  return container.querySelectorAll(selectors);
}

function checkForPreviouslyFocusedElement(
  elements: NodeListOf<Element>,
  selectedClassName?: ClassName,
) {
  // Checks for selected class and refocuses if exists. Otherwise, focuses first element.
  const elemArray = Array.from(elements);
  let elementToSelect = elemArray.find((element) =>
    element.className.includes(selectedClassName ?? SELECTED_CLASSNAME),
  ) as HTMLElement;
  if (!elementToSelect) {
    elementToSelect = elements[0] as HTMLElement;
  }
  return elementToSelect;
}

export function focusElement(
  element: HTMLElement,
  event: KeyboardEvent,
  containerIndex: number,
  autoSelect?: AutoSelect,
) {
  // Focus the given element (and click if autoSelect is true) and prevent default action
  if (!element) {
    return;
  }
  element.focus();
  let select = false;
  if (autoSelect && typeof autoSelect === 'boolean') {
    select = true;
  }
  if (
    autoSelect &&
    typeof autoSelect === 'object' &&
    autoSelect[containerIndex]
  ) {
    select = true;
  }
  if (select) {
    element.click();
  }
  event.preventDefault();
}

export function parseContainer(container: Container) {
  // Containers can be passed as an id string (in which case the container element will
  // be got from DOM), or a React Ref (in which case the `current` object will be returned).
  return typeof container !== 'string'
    ? container.current
    : document.getElementById(container);
}

export function moveToContainer(
  container: Element,
  setContainerIndex: ContainerIndexSetter,
  forwardDirection: boolean,
  event: KeyboardEvent,
  selectors?: string,
  selectedClassName?: ClassName,
) {
  // Selects an element within the given container and focuses it.
  // See `lib/checkForPreviouslyFocusedElement`
  if (!container) {
    return;
  }
  let containerElements = getFocusableElements(container, selectors);
  if (!containerElements.length) {
    containerElements = getFocusableElements(
      container,
      parseSelectors(allSelectors),
    );
    if (!containerElements.length) {
      return;
    }
  }
  const elementToSelect = checkForPreviouslyFocusedElement(
    containerElements,
    selectedClassName,
  );
  if (elementToSelect) {
    event.preventDefault();
    setContainerIndex((prev) => (forwardDirection ? prev + 1 : prev - 1));
    elementToSelect.focus();
  }
}

function handleSwitchContainer(
  event: KeyboardEvent,
  containers: Element[],
  containerIndex: number,
  setContainerIndex: ContainerIndexSetter,
  selectors: string,
  selectedClassName?: ClassName,
) {
  if ((event.key === 'Tab' && event.shiftKey) || event.key === 'ArrowLeft') {
    // Focus previous container
    const prevContainerElement: Element =
      containerIndex > 0 ? containers[containerIndex - 1] : undefined;
    moveToContainer(
      prevContainerElement,
      setContainerIndex,
      false,
      event,
      selectors,
      selectedClassName,
    );
  } else if (['Tab', 'ArrowRight'].includes(event.key)) {
    // Focus next container
    const nextContainerElement: Element =
      containerIndex < containers.length - 1
        ? containers[containerIndex + 1]
        : undefined;
    moveToContainer(
      nextContainerElement,
      setContainerIndex,
      true,
      event,
      selectors,
      selectedClassName,
    );
  }
}

function handleUpDown(
  event: KeyboardEvent,
  activeElement: Element,
  elements: NodeListOf<Element>,
  containerIndex: number,
  autoSelect?: AutoSelect,
) {
  // Get index of currently focused element, and focus next or previous element in collection
  // depending on keypress
  const currentIndex = Array.from(elements).findIndex(
    (availableElement) => availableElement === activeElement,
  );
  let nextElement;
  if (event.key === 'ArrowDown') {
    nextElement = elements[currentIndex + 1] as HTMLElement;
  }
  if (event.key === 'ArrowUp') {
    nextElement = elements[currentIndex - 1] as HTMLElement;
  }
  focusElement(nextElement, event, containerIndex, autoSelect);
}

export function handleEvents(
  event: KeyboardEvent,
  containers: Element[],
  containerIndex: number,
  setContainerIndex: ContainerIndexSetter,
  options?: Options,
) {
  // Check for acceptable conditions, and handle keyboard events for either Left/Right/(Tab) keypress
  // (switch container), or Up/Down (move through given selectors / focusable elements).
  if (!containers.length) {
    return;
  }
  const activeElement = document.activeElement;
  const container = containers[containerIndex];
  const key = event.key;
  if (
    !['ArrowUp', 'ArrowDown', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(key)
  ) {
    return;
  }

  const { selectors, autoSelect, tabKeyContainerLevel, selectedClassName } =
    options ?? {
      selectors: undefined,
      autoSelect: undefined,
      tabKeyContainerLevel: undefined,
      selectedClassName: undefined,
    };

  // Get all elements that should/can be focused
  const parsedSelectors = parseSelectors(selectors ? selectors : allSelectors);
  const elements = container.querySelectorAll(parsedSelectors);
  // Handle Left/Right arrow keys and Tab key if `tabKeyContainerLevel` is true
  if (containers.length > 1) {
    if (
      (key === 'Tab' && tabKeyContainerLevel) ||
      ['ArrowLeft', 'ArrowRight'].includes(key)
    ) {
      handleSwitchContainer(
        event,
        containers,
        containerIndex,
        setContainerIndex,
        parsedSelectors,
        selectedClassName,
      );
      return;
    }
  }
  // Otherwise, handle navigating through main list of elements with Up/Down arrow keys
  handleUpDown(event, activeElement, elements, containerIndex, autoSelect);
}

/** Allows keyboard navigation through given container element(s). Options include modifying the Tab key
 * behaviour to navigate containers rather than their children (`tabKeyContainerLevel: boolean = false`), and a toggle to automatically select elements
 * within individual containers (`autoSelect: boolean | {[containerIndex: number]: boolean}` (default `false`)).
 * @param {Container | Container[]} container The parent container or array of containers to navigate
 * @param {Options} options An object containing optional customisations of the event handler behaviour
 */
export function useKeyboardNavigation(
  container: Container | Container[],
  options?: Options,
) {
  const containers: Element[] = [];
  React.useEffect(() => {
    if (Array.isArray(container)) {
      if (parseContainer(container[0]) && !containers.length) {
        container.forEach((containerElement) => {
          containers.push(parseContainer(containerElement));
        });
      }
    } else if (!containers.length) {
      containers.push(parseContainer(container));
    }
  }, [container]);

  const [containerIndex, setContainerIndex] = React.useState(0);

  const eventHandler = React.useCallback(
    (event: KeyboardEvent) => {
      handleEvents(
        event,
        containers,
        containerIndex,
        setContainerIndex,
        options,
      );
    },
    [containerIndex, options],
  );

  React.useEffect(() => {
    window.addEventListener('keydown', eventHandler);
    return () => {
      window.removeEventListener('keydown', eventHandler);
    };
  }, [eventHandler]);
}
