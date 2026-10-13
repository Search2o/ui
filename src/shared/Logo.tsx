import logoLight from "@/assets/logo.png";
import logoDark from "@/assets/logo-dark.png";

export function Logo({ className = "h-6 w-auto select-none" }: { className?: string }) {
    return (
        <>
            <img
                src={logoLight}
                alt="Search2o"
                className={`${className} dark:hidden`}
                draggable={false}
            />
            <img
                src={logoDark}
                alt="Search2o"
                className={`${className} hidden dark:block`}
                draggable={false}
            />
        </>
    );
}
