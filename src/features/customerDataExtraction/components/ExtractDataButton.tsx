import type { RefObject } from 'react';
import type { UseFormSetValue } from 'react-hook-form';
import type { CustomerFormData } from '../../../pages/Customers/types';
import { DocumentExtractButton } from './DocumentExtractButton';
import { extractCustomerDataFromDocument } from '../services/customerExtractionService';

export function ExtractDataButton({ formRef, setValue }: { formRef: RefObject<HTMLFormElement>; setValue: UseFormSetValue<CustomerFormData> }) {
  return <DocumentExtractButton formRef={formRef} label="استخراج البيانات" extract={extractCustomerDataFromDocument} setFieldValue={(name, value) => setValue(name as keyof CustomerFormData, value as never, { shouldValidate: true, shouldDirty: true })} />;
}
