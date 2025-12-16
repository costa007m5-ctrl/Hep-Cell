    const handleManageInvoice = async (invoiceId: string, action: 'pay' | 'cancel' | 'delete') => {
        try {
             const res = await fetch('/api/admin/manage-invoice', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ invoiceId, action })
            });
             
             const data = await res.json();

             if (res.ok) {
                setSuccessMessage('Operação realizada com sucesso!');
                setTimeout(() => setSuccessMessage(null), 3000);
                fetchData(); 
            } else {
                 const error = data && typeof data === 'object' && 'error' in data ? String((data as any).error) : 'Falha na operação.';
                 alert(`Erro: ${error}`);
            }
        } catch (e: unknown) { 
            console.error(e); 
            const errorMsg = e instanceof Error ? e.message : 'Erro de conexão.';
            alert(errorMsg); 
        }
    };