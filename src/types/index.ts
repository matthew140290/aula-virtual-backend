// src/types/index.ts

// Tipo base para representar la estructura de un anuncio en la base de datos
export interface Anuncio {
    ID_Anuncio: number;
    Titulo: string;
    Contenido: string;
    FechaCreacion: string;
    ID_Usuario: number;
    ID_Curso: number | null; // null para anuncios institucionales
    NombreUsuario?: string;
}
