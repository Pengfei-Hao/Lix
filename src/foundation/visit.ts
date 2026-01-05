export interface WithChildren<T> {
    children: T[];
}

export function visit<T extends WithChildren<T>>(node: T, callback: (node: T) => void) {
    callback(node);
    node.children.forEach((child) => {
        visit(child, callback);
    });
}