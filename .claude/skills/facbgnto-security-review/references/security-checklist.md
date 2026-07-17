# Checklist de seguridad

## Autorización
- ¿Cada endpoint valida permisos en backend?
- ¿Cambiar un ID permite acceder a recursos ajenos?
- ¿Toda consulta filtra por tenant/club y propietario?
- ¿Las relaciones evitan referencias cruzadas?

## Autenticación
- ¿Tokens y OTP expiran y pueden invalidarse?
- ¿Existe rate limiting?
- ¿Las cookies usan Secure, HttpOnly y SameSite?
- ¿Se evita enumerar usuarios?

## Entradas
- ¿Hay esquemas, límites y tipos?
- ¿Las consultas están parametrizadas?
- ¿URLs externas bloquean SSRF?
- ¿Rutas y nombres de archivo evitan traversal?

## Datos
- ¿Logs excluyen tokens y datos sensibles?
- ¿Exportaciones y archivos requieren autorización?
- ¿Se minimiza la información devuelta?

## Operación
- ¿Hay auditoría?
- ¿Los errores ocultan detalles internos?
- ¿Las dependencias tienen vulnerabilidades conocidas?
