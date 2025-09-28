declare module '/pagefind/pagefind.js' {
  import type { PagefindClient } from '../components/islands/PagefindSearch';

  const pagefind: PagefindClient;
  export default pagefind;
  export const init: PagefindClient['init'];
  export const search: PagefindClient['search'];
}
