% Function that returns number of violated clauses for given variable

% INPUT :
% Clauses -  A matrix of Clauses   
% var - The number of variables 
% nc - The number of Clauses 

% OUTPUT :
% CMat - A matrix(nc by var) signifying the mapping between clauses and
% variables


function [CMat]=generate_cmat(Clauses,var,nc)

C=nc;
N=var;

CMat=zeros(C,N);
for j=1:N
    for k=1:C
        if(any(Clauses(k,:)==j))
            CMat(k,j)=1;
        end
        if(any(Clauses(k,:)==-j))
            CMat(k,j)=-1;
        end
    end
end