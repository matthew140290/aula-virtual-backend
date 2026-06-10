export interface StudentViewContext {
  NombreGrado: string;
  NombreCurso: string;
}

export interface DecodedUserToken {
  codigo: number;
  perfil: string;
  nombre: string;
  nombreCompleto: string;
  tenantId: string;
  originalPerfil?: string;
  contexto?: StudentViewContext;
}
