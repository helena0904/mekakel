/**
 * Preliminary ABO/Rh compatibility.
 *
 * IMPORTANT: this is a non-clinical coordination aid. It applies rule-of-thumb
 * ABO/Rh compatibility appropriate to the requested component so hospitals can
 * shortlist potential sources. It NEVER replaces the cross-matching,
 * antibody screening and final compatibility decision performed by authorized
 * clinical staff before any transfusion.
 */

export type BloodTypeValue =
  | 'A_POSITIVE'
  | 'A_NEGATIVE'
  | 'B_POSITIVE'
  | 'B_NEGATIVE'
  | 'AB_POSITIVE'
  | 'AB_NEGATIVE'
  | 'O_POSITIVE'
  | 'O_NEGATIVE'

export type BloodComponentValue =
  | 'WHOLE_BLOOD'
  | 'RED_CELLS'
  | 'PLASMA'
  | 'PLATELETS'
  | 'CRYOPRECIPITATE'

export type AboValue = 'A' | 'B' | 'AB' | 'O'
export type RhValue = 'POSITIVE' | 'NEGATIVE'

const ALL_BLOOD_TYPES: BloodTypeValue[] = [
  'A_POSITIVE',
  'A_NEGATIVE',
  'B_POSITIVE',
  'B_NEGATIVE',
  'AB_POSITIVE',
  'AB_NEGATIVE',
  'O_POSITIVE',
  'O_NEGATIVE',
]

export function aboOf(bloodType: string): AboValue {
  return bloodType.split('_')[0] as AboValue
}

export function rhOf(bloodType: string): RhValue {
  return bloodType.endsWith('NEGATIVE')
    ? 'NEGATIVE'
    : 'POSITIVE'
}

/**
 * Red-cell direction: O is the universal donor, AB the universal recipient.
 * Applies to whole blood, red cells, platelets and cryoprecipitate, where the
 * recipient's antibodies act against the donor's ABO antigens.
 */
export function isAboRedCellCompatible(
  donorType: string,
  recipientType: string
): boolean {
  const donor = aboOf(donorType)
  const recipient = aboOf(recipientType)

  if (recipient === 'AB') {
    return true
  }

  if (donor === 'O') {
    return true
  }

  return donor === recipient
}

/**
 * Plasma direction is reversed: AB plasma carries no anti-A/anti-B and is the
 * universal donor; O recipients may receive plasma from every group.
 */
export function isAboPlasmaCompatible(
  donorType: string,
  recipientType: string
): boolean {
  const donor = aboOf(donorType)
  const recipient = aboOf(recipientType)

  if (recipient === 'O') {
    return true
  }

  if (donor === 'AB') {
    return true
  }

  return donor === recipient
}

/**
 * Rh compatibility. An Rh-negative recipient must not receive Rh-positive
 * red-cell bearing components.
 */
export function isRhCompatible(
  donorType: string,
  recipientType: string
): boolean {
  if (rhOf(recipientType) === 'POSITIVE') {
    return true
  }

  return rhOf(donorType) === 'NEGATIVE'
}

function isPlasma(component: string): boolean {
  return component === 'PLASMA'
}

/**
 * Preliminary compatibility of a donor unit/donor for a component request.
 */
export function isCompatible(
  donorType: string,
  recipientType: string,
  component: string
): boolean {
  if (isPlasma(component)) {
    return isAboPlasmaCompatible(donorType, recipientType)
  }

  return (
    isAboRedCellCompatible(donorType, recipientType) &&
    isRhCompatible(donorType, recipientType)
  )
}

/**
 * The donor blood types that could be compatible with a recipient for a
 * component. Used to narrow database queries before the exact check.
 */
export function compatibleDonorTypes(
  recipientType: string,
  component: string
): BloodTypeValue[] {
  return ALL_BLOOD_TYPES.filter((donorType) =>
    isCompatible(donorType, recipientType, component)
  )
}

export interface CompatibilityExplanation {
  compatible: boolean
  component: string
  rule: string
  detail: string
}

export function explainCompatibility(
  donorType: string,
  recipientType: string,
  component: string
): CompatibilityExplanation {
  const compatible = isCompatible(
    donorType,
    recipientType,
    component
  )

  if (isPlasma(component)) {
    return {
      compatible,
      component,
      rule: 'Plasma ABO (reversed)',
      detail: compatible
        ? 'Plasma ABO direction is compatible with the recipient.'
        : 'Plasma ABO direction is not compatible with the recipient.',
    }
  }

  const aboOk = isAboRedCellCompatible(
    donorType,
    recipientType
  )
  const rhOk = isRhCompatible(donorType, recipientType)

  return {
    compatible,
    component,
    rule: 'ABO and Rh',
    detail: aboOk
      ? rhOk
        ? 'ABO and Rh are both compatible.'
        : 'ABO is compatible but Rh is not suitable for a Rh-negative recipient.'
      : 'ABO is not compatible with the recipient.',
  }
}
