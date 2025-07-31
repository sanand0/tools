export const readFiles = (input, kind = "text") => Promise.all([...input.files].map((f) => f[kind]()));
