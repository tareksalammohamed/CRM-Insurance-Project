import type { RefObject } from 'react';
import type { UseFormSetValue } from 'react-hook-form';
import type { PolicyFormData } from '../../../pages/Policies/types';
import { DocumentExtractButton } from '../../customerDataExtraction/components/DocumentExtractButton';
import { extractPolicyDataFromDocument } from '../services/policyDocumentExtractionService';

export function ExtractPolicyDataButton({ formRef, setValue, expectedCustomerName }: { formRef: RefObject<HTMLFormElement>; setValue: UseFormSetValue<PolicyFormData>; expectedCustomerName?: string }) {
  return <DocumentExtractButton formRef={formRef} label="استخراج بيانات الوثيقة بالذكاء الاصطناعي" extract={(images, fields) => extractPolicyDataFromDocument(images, fields, expectedCustomerName)} setFieldValue={(name, value) => setValue(name as keyof PolicyFormData, value as never, { shouldValidate: true, shouldDirty: true })} />;
}
