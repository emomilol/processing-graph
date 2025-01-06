
export function deepClone<T>(input: T, filterOut: (key: string) => boolean = (key) => false): T {
  if (input === null || typeof input !== 'object') {
    return input;
  }

  // Initialize the stack for iteration
  const stack: Array<{ source: any; target: any; key?: string }> = [];

  // Result is either an array or object based on input
  const output = Array.isArray(input) ? [] : {};

  // Push the initial object/array and its clone to the stack
  stack.push({ source: input, target: output });

  while (stack.length) {
    const { source, target, key } = stack.pop()!;

    // If a key is provided, clone into the corresponding key in the target object/array
    const currentTarget = key !== undefined ? target[key] : target;

    for (const [k, value] of Object.entries(source)) {
      if (filterOut(k)) {
        continue;
      }

      if (value && typeof value === 'object') {
        // If value is an object or array, create a corresponding clone
        const clonedValue = Array.isArray(value) ? [] : {};
        currentTarget[k] = clonedValue;

        // Push the nested object/array and its clone onto the stack
        stack.push({ source: value, target: currentTarget, key: k });
      } else {
        // Otherwise, directly assign the primitive value
        currentTarget[k] = value;
      }
    }
  }

  return output as T;
}

