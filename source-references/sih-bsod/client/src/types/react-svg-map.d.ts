declare module 'react-svg-map' {
    import { FC, MouseEvent, ReactNode, FocusEvent, CSSProperties } from 'react';

    interface SVGMapProps {
        map: any;
        className?: string;
        style?: CSSProperties;
        locationClassName?: string | ((location: any, index: number) => string);
        locationTabIndex?: number | null;
        locationAriaLabel?: (location: { id: string; name?: string }) => string | undefined;
        onLocationMouseOver?: (event: MouseEvent) => void;
        onLocationMouseOut?: (event: MouseEvent) => void;
        onLocationClick?: (event: MouseEvent) => void;
        onLocationFocus?: (event: FocusEvent) => void;
        onLocationBlur?: (event: FocusEvent) => void;
        childrenBefore?: ReactNode;
        childrenAfter?: ReactNode;
    }

    export const SVGMap: FC<SVGMapProps>;
}

declare module '@svg-maps/india' {
    const india: {
        viewBox: string;
        locations: Array<{
            path: string;
            id: string;
            name?: string;
        }>;
    };
    export default india;
}
