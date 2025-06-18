/**
 * Represents a geographical coordinate with latitude and longitude.
 */
export interface Coordinate {
  /**
   * The latitude of the location.
   */
  latitude: number;
  /**
   * The longitude of the location.
   */
  longitude: number;
}

/**
 * Represents the address information for a given coordinate.
 */
export interface Address {
  /**
   * The street address.
   */
  street: string;
  /**
   * The city of the address.
   */
  city: string;
  /**
   * The state or region of the address.
   */
  state: string;
  /**
   * The postal code of the address.
   */
  postalCode: string;
  /**
   * The country of the address.
   */
  country: string;
}

/**
 * Retrieves the address for a given coordinate.
 *
 * @param coordinate The coordinate to retrieve the address for.
 * @returns A promise that resolves to an Address object.
 */
export async function getAddressForCoordinate(coordinate: Coordinate): Promise<Address> {
  // TODO: Implement this by calling an API.

  return {
    street: '1600 Amphitheatre Parkway',
    city: 'Mountain View',
    state: 'CA',
    postalCode: '94043',
    country: 'USA',
  };
}
