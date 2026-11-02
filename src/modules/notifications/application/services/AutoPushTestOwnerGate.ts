
/*
 * Restricción temporal de envíos
 * automáticos durante las pruebas.
 *
 * Sin un propietario configurado,
 * no se permite ningún envío.
 */
export function isAutoPushTestOwnerAllowed(
  ownerId: string
): boolean {

  const configured =
    (
      process.env.AUTO_PUSH_TEST_OWNER_ID ??
      ""
    )
      .trim()
      .toLowerCase();

  if (
    !/^[a-f0-9]{24}$/.test(configured)
  ) {
    return false;
  }

  return (
    ownerId.trim().toLowerCase() ===
    configured
  );
}

