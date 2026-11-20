/** lottie-react pulls lottie-web, which touches `document` on import; the node render test never animates. */
const Lottie = () => null;
export default Lottie;
export type LottieComponentProps = Record<string, unknown>;
