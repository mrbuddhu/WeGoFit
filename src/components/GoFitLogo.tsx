interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  sm: 28,
  md: 40,
  lg: 56,
  xl: 80,
};

export default function GoFitLogo({ size = 'md', className = '' }: Props) {
  const height = sizes[size];
  return (
    <div className={`flex items-center select-none ${className}`}>
      <img
        src="/wegofit-logo.png"
        alt="WeGoFit"
        style={{ height, width: 'auto', display: 'block', objectFit: 'contain' }}
      />
    </div>
  );
}
