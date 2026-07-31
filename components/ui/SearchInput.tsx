import { InputHTMLAttributes } from "react";
import clsx from "clsx";

type SearchInputProps = InputHTMLAttributes<HTMLInputElement> & {
  wrapperClassName?: string;
};

export function SearchInput({ className, wrapperClassName, ...props }: SearchInputProps) {
  return (
    <div className={clsx("relative", wrapperClassName)}>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
        🔍
      </span>

      <input
        type="text"
        className={clsx(
          "w-full rounded-xl border border-gray-700 bg-black py-3 pl-11 pr-4 text-white outline-none placeholder:text-gray-600 focus:border-yellow-500",
          className
        )}
        {...props}
      />
    </div>
  );
}
