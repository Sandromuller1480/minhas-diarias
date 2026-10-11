import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { EntryWithRelations, ReportSummary } from '../../types/domain'
import { formatDateBr } from '../../lib/date'
import { formatCurrency } from '../finance/money'

type PdfOptions = {
  professionalName: string
  contractorName: string
  periodLabel: string
  reportId: string
  entries: EntryWithRelations[]
  summary: ReportSummary
  finalNote?: string
  compactFullDays: boolean
}

export function generateReportPdf(options: PdfOptions): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const issuedAt = new Date().toLocaleDateString('pt-BR')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Demonstrativo de diárias de pintura', 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Profissional: ${options.professionalName}`, 14, 28)
  doc.text(`Contratante: ${options.contractorName}`, 14, 34)
  doc.text(`Período: ${options.periodLabel}`, 14, 40)
  doc.text(`Emissão: ${issuedAt}`, 14, 46)
  doc.text(`Identificação: ${options.reportId}`, 14, 52)

  autoTable(doc, {
    startY: 60,
    head: [['Data', 'Obra', 'Período', 'Valor', 'Pago', 'Saldo']],
    body: options.entries.map((entry) => [
      formatDateBr(entry.workDate),
      entry.project?.name ?? 'Obra não informada',
      entry.period === 'morning' ? 'Manhã' : 'Tarde',
      formatCurrency(entry.amountCents),
      formatCurrency(entry.paidCents),
      formatCurrency(entry.balanceCents),
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [19, 98, 183],
      textColor: 255,
    },
    columnStyles: {
      1: { cellWidth: 58 },
    },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages()
      doc.setFontSize(8)
      doc.text(`Página ${pageCount}`, 184, 290)
    },
  })

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60
  const y = finalY + 10 > 255 ? 20 : finalY + 10
  if (finalY + 10 > 255) doc.addPage()

  doc.setFont('helvetica', 'bold')
  doc.text('Resumo', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`Dias com trabalho: ${options.summary.workedDays}`, 14, y + 8)
  doc.text(`Diárias equivalentes: ${options.summary.equivalentDailies.toLocaleString('pt-BR')}`, 14, y + 14)
  doc.text(`Total dos serviços: ${formatCurrency(options.summary.serviceTotalCents)}`, 14, y + 20)
  doc.text(`Pagamentos atribuídos: ${formatCurrency(options.summary.allocatedPaidCents)}`, 14, y + 26)
  doc.text(`Saldo a receber: ${formatCurrency(options.summary.balanceCents)}`, 14, y + 32)
  doc.text('Documento demonstrativo. Não é nota fiscal.', 14, y + 42)

  if (options.finalNote) {
    doc.text(doc.splitTextToSize(`Observação: ${options.finalNote}`, 180), 14, y + 50)
  }

  return doc.output('blob')
}
