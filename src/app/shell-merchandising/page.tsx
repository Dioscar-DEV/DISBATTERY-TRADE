'use client';

import { ShellMerchandisingPage } from './page-content';
import { Suspense } from 'react';

// Este es un componente "contenedor" que solo agrega el Suspense Boundary
function ShellMerchandising() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <ShellMerchandisingPage />
    </Suspense>
  );
}

export default ShellMerchandising;
