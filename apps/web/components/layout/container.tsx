export default function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 justify-center px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <div className="relative w-full">{children}</div>
    </div>
  );
}
