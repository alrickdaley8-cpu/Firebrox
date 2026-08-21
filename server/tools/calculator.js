/** Safe math expression evaluator (no eval / Function). */
export function evaluate(expression) {
  const src = String(expression).replace(/\s+/g, '');
  if (!src) throw new Error('Empty expression');
  if (src.length > 500) throw new Error('Expression too long');

  let i = 0;

  const peek = () => src[i];
  const done = () => i >= src.length;

  function parseNumber() {
    const start = i;
    if (peek() === '-' || peek() === '+') i++;
    let digits = 0;
    while (i < src.length && /[0-9.]/.test(src[i])) {
      if (src[i] === '.') digits++;
      i++;
    }
    // scientific notation
    if (src[i] === 'e' || src[i] === 'E') {
      i++;
      if (src[i] === '-' || src[i] === '+') i++;
      while (i < src.length && /[0-9]/.test(src[i])) i++;
    }
    if (i === start) throw new Error(`Unexpected token "${src[i]}" at position ${i}`);
    const num = Number(src.slice(start, i));
    if (Number.isNaN(num)) throw new Error(`Invalid number "${src.slice(start, i)}"`);
    return num;
  }

  function parsePrimary() {
    if (peek() === '(') {
      i++;
      const v = parseExpr(0);
      if (peek() !== ')') throw new Error('Missing closing parenthesis');
      i++;
      return v;
    }
    // named functions
    const funcs = ['sqrt', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'ln', 'exp', 'abs', 'floor', 'ceil', 'round'];
    for (const f of funcs) {
      if (src.startsWith(f + '(', i)) {
        i += f.length + 1;
        const arg = parseExpr(0);
        if (peek() !== ')') throw new Error(`Missing ")" after ${f}(...)`);
        i++;
        const a = arg;
        switch (f) {
          case 'sqrt': return Math.sqrt(a);
          case 'sin': return Math.sin(a);
          case 'cos': return Math.cos(a);
          case 'tan': return Math.tan(a);
          case 'asin': return Math.asin(a);
          case 'acos': return Math.acos(a);
          case 'atan': return Math.atan(a);
          case 'log': return Math.log10(a);
          case 'ln': return Math.log(a);
          case 'exp': return Math.exp(a);
          case 'abs': return Math.abs(a);
          case 'floor': return Math.floor(a);
          case 'ceil': return Math.ceil(a);
          case 'round': return Math.round(a);
          default: throw new Error(`Unknown function ${f}`);
        }
      }
    }
    // constants
    if (src.startsWith('pi', i)) { i += 2; return Math.PI; }
    if (src.startsWith('e', i)) { i += 1; return Math.E; }
    return parseNumber();
  }

  function parsePower() {
    const base = parsePrimary();
    if (peek() === '^') {
      i++;
      const exponent = parsePower(); // right-associative: a^b^c = a^(b^c)
      return Math.pow(base, exponent);
    }
    return base;
  }

  function parseUnary() {
    if (peek() === '-') { i++; return -parseUnary(); }
    if (peek() === '+') { i++; return parseUnary(); }
    return parsePower();
  }

  function parseTerm() {
    let left = parseUnary();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = peek();
      i++;
      const right = parseUnary();
      if (op === '*') left *= right;
      else if (op === '/') left /= right;
      else left %= right;
    }
    return left;
  }

  function parseExpr() {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = peek();
      i++;
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  const value = parseExpr();
  if (!done()) throw new Error(`Unexpected token "${src[i]}" at position ${i}`);
  if (!Number.isFinite(value)) throw new Error('Result is not a finite number');
  return value;
}
