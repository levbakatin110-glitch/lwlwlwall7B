export {};

declare global {
  interface Window {
    /** Console: __mayaBetterStackTest() — отправить тестовую ошибку в Better Stack */
    __mayaBetterStackTest?: () => void;
  }
}
