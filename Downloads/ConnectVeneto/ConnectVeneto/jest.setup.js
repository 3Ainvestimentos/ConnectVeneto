// tLearn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

const React = require('react');
jest.mock('lucide-react', () => {
  return new Proxy(
    {},
    {
      get: (_, iconName) => {
        return function MockIcon() { return null; };
      },
    }
  );
});

jest.mock('react-markdown', () => {
  return function ReactMarkdownMock() {
    return null;
  };
});

jest.mock('remark-gfm', () => () => []);

if (!global.fetch) {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
  }));
}

if (!global.Response) {
  global.Response = class Response {};
}

if (!global.Headers) {
  global.Headers = class Headers {};
}

if (!global.Request) {
  global.Request = class Request {};
}

